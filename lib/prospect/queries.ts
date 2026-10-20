import type { z } from "zod";
import type { D1Binding } from "@/lib/runtime-bindings";
import { monthStart, PROVIDERS } from "./budget";
import type { BrandBrief } from "./brief";
import type { ReviewResult } from "./reviewer";
import type { listFiltersSchema } from "./schemas";
import type { ScoreLine } from "./scoring";
import { getAgentConfig, getProspect, parseJson } from "./service";
import { AGENTS, type ProspectRow, type ProspectStatus, PROSPECT_STATUSES } from "./types";
import type { WebsiteAnalysis } from "./website-analyzer";

const PROSPECT_ENTITY_TYPES = "('prospect','message','demo','suppression','agent','budget','team','campaign')";

export async function listProspects(db: D1Binding, filters: z.infer<typeof listFiltersSchema>) {
  const where = ["deleted_at IS NULL"];
  const values: unknown[] = [];
  const add = (clause: string, ...params: unknown[]) => {
    where.push(clause);
    values.push(...params);
  };
  if (filters.status) add("status = ?", filters.status);
  if (filters.city) add("city = ?", filters.city);
  if (filters.category) add("category = ?", filters.category);
  if (filters.q) add("(name LIKE ? OR zone LIKE ?)", `%${filters.q}%`, `%${filters.q}%`);
  const { results } = await db.prepare(`SELECT id, name, category, city, zone, status, score, website, email_public, phone_public, instagram_url, source, missing_evidence, updated_at FROM prospect_prospects WHERE ${where.join(" AND ")} ORDER BY score DESC, updated_at DESC LIMIT ?`).bind(...values, filters.limit).all<Pick<ProspectRow, "id" | "name" | "category" | "city" | "zone" | "status" | "score" | "website" | "email_public" | "phone_public" | "instagram_url" | "source" | "missing_evidence" | "updated_at">>();
  return results;
}

export async function listFacets(db: D1Binding) {
  const [cities, categories] = await Promise.all([
    db.prepare("SELECT DISTINCT city AS v FROM prospect_prospects ORDER BY city").all<{ v: string }>(),
    db.prepare("SELECT DISTINCT category AS v FROM prospect_prospects ORDER BY category").all<{ v: string }>(),
  ]);
  return { cities: cities.results.map((r) => r.v), categories: categories.results.map((r) => r.v) };
}

export type MessageView = { id: string; channel: string; step: number; recipient: string; subject: string | null; body: string; status: string; review: ReviewResult | null; approved_by: string | null; sent_by: string | null; sent_at: string | null; created_at: string; prospect_id: string; prospect_name?: string };

export async function getProspectDetail(db: D1Binding, id: string) {
  const prospect = await getProspect(db, id);
  const [evidence, audits, assets, demos, messages, activities, campaign] = await Promise.all([
    db.prepare("SELECT id, kind, source_url, observed_at, data, created_by FROM prospect_evidence WHERE prospect_id = ? ORDER BY observed_at DESC").bind(id).all<{ id: string; kind: string; source_url: string; observed_at: string; data: string; created_by: string }>(),
    db.prepare("SELECT id, version, status, generator, brief, created_by, created_at FROM prospect_brand_audits WHERE prospect_id = ? ORDER BY version DESC").bind(id).all<{ id: string; version: number; status: string; generator: string; brief: string; created_by: string; created_at: string }>(),
    db.prepare("SELECT id, brand_audit_id, prompt, provider, model, status, created_at FROM prospect_assets WHERE prospect_id = ? ORDER BY created_at DESC").bind(id).all<{ id: string; brand_audit_id: string; prompt: string; provider: string; model: string; status: string; created_at: string }>(),
    db.prepare("SELECT id, version, status, view_count, last_viewed_at, access_expires_at, access_token_hash IS NOT NULL AS has_link, approved_by, approved_at, created_at FROM prospect_demos WHERE prospect_id = ? ORDER BY version DESC").bind(id).all<{ id: string; version: number; status: string; view_count: number; last_viewed_at: string | null; access_expires_at: string | null; has_link: number; approved_by: string | null; approved_at: string | null; created_at: string }>(),
    db.prepare("SELECT id, prospect_id, channel, step, recipient, subject, body, status, review, approved_by, sent_by, sent_at, created_at FROM prospect_messages WHERE prospect_id = ? ORDER BY created_at DESC").bind(id).all<Omit<MessageView, "review"> & { review: string | null }>(),
    db.prepare("SELECT id, type, occurred_at, scheduled_at, summary, deal_value_mxn, created_by FROM prospect_activities WHERE prospect_id = ? ORDER BY occurred_at DESC").bind(id).all<{ id: string; type: string; occurred_at: string; scheduled_at: string | null; summary: string; deal_value_mxn: number | null; created_by: string }>(),
    prospect.campaign_id ? db.prepare("SELECT id, name FROM prospect_campaigns WHERE id = ?").bind(prospect.campaign_id).first<{ id: string; name: string }>() : Promise.resolve(null),
  ]);
  const relatedIds = [id, ...demos.results.map((d) => d.id), ...messages.results.map((m) => m.id)];
  const trail = await db.prepare(`SELECT action, entity_type, entity_id, payload, created_at FROM audit_logs WHERE entity_id IN (${relatedIds.map(() => "?").join(",")}) ORDER BY created_at DESC, rowid DESC LIMIT 100`).bind(...relatedIds).all<{ action: string; entity_type: string; entity_id: string; payload: string; created_at: string }>();
  return {
    prospect,
    signals: parseJson<Record<string, number | null>>(prospect.signals, {}),
    scoreLines: parseJson<ScoreLine[]>(prospect.score_breakdown, []),
    missing: parseJson<string[]>(prospect.missing_evidence, []),
    evidence: evidence.results.map((e) => ({ ...e, data: parseJson<Record<string, unknown>>(e.data, {}) })),
    website: parseJson<WebsiteAnalysis | null>(evidence.results.find((e) => e.kind === "website")?.data, null),
    brandAudits: audits.results.map((a) => ({ ...a, brief: parseJson<BrandBrief | null>(a.brief, null) })),
    assets: assets.results,
    demos: demos.results,
    messages: messages.results.map((m) => ({ ...m, review: parseJson<ReviewResult | null>(m.review, null) })),
    activities: activities.results,
    campaign,
    trail: trail.results.map((t) => ({ ...t, payload: parseJson<Record<string, unknown>>(t.payload, {}) })),
  };
}

export async function dashboardMetrics(db: D1Binding, now: Date) {
  const since30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [statusRows, demoStats, pending, sent30, won, upcoming, spend, budgets] = await Promise.all([
    db.prepare("SELECT status, COUNT(*) AS n, AVG(score) AS avg FROM prospect_prospects WHERE deleted_at IS NULL GROUP BY status").all<{ status: ProspectStatus; n: number; avg: number }>(),
    db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved, COALESCE(SUM(view_count), 0) AS views FROM prospect_demos").first<{ total: number; approved: number; views: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM prospect_messages WHERE status IN ('draft', 'approved')").first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM prospect_messages WHERE status = 'sent' AND sent_at >= ?").bind(since30).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(deal_value_mxn), 0) AS revenue FROM prospect_activities WHERE type = 'won'").first<{ n: number; revenue: number }>(),
    db.prepare("SELECT a.prospect_id, a.scheduled_at, a.summary, p.name FROM prospect_activities a JOIN prospect_prospects p ON p.id = a.prospect_id WHERE a.type = 'meeting' AND a.scheduled_at >= ? ORDER BY a.scheduled_at LIMIT 5").bind(now.toISOString()).all<{ prospect_id: string; scheduled_at: string; summary: string; name: string }>(),
    db.prepare("SELECT provider, COALESCE(SUM(cost_usd_micros), 0) AS micros FROM prospect_api_usage WHERE created_at >= ? GROUP BY provider").bind(monthStart(now)).all<{ provider: string; micros: number }>(),
    db.prepare("SELECT provider, monthly_limit_usd_cents, enabled FROM prospect_provider_budgets").all<{ provider: string; monthly_limit_usd_cents: number; enabled: number }>(),
  ]);
  const byStatus = Object.fromEntries(PROSPECT_STATUSES.map((s) => [s, 0])) as Record<ProspectStatus, number>;
  for (const row of statusRows.results) byStatus[row.status] = row.n;
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const reachedContact = byStatus.contacted + byStatus.replied + byStatus.meeting + byStatus.won + byStatus.lost;
  const replied = byStatus.replied + byStatus.meeting + byStatus.won;
  const totalSpendMicros = spend.results.reduce((sum, row) => sum + row.micros, 0);
  const allTimeSpend = await db.prepare("SELECT COALESCE(SUM(cost_usd_micros), 0) AS micros FROM prospect_api_usage").first<{ micros: number }>();
  return {
    total,
    byStatus,
    demos: demoStats ?? { total: 0, approved: 0, views: 0 },
    pendingMessages: pending?.n ?? 0,
    sentLast30: sent30?.n ?? 0,
    won: won ?? { n: 0, revenue: 0 },
    upcomingMeetings: upcoming.results,
    replyRate: reachedContact ? replied / reachedContact : null,
    winRate: reachedContact ? byStatus.won / reachedContact : null,
    spendThisMonthMicros: totalSpendMicros,
    costPerWonMicros: won?.n ? (allTimeSpend?.micros ?? 0) / won.n : null,
    spendByProvider: PROVIDERS.map((provider) => ({ provider, micros: spend.results.find((r) => r.provider === provider)?.micros ?? 0, budget: budgets.results.find((b) => b.provider === provider) ?? null })),
  };
}

export async function listBrandAudits(db: D1Binding) {
  const { results } = await db.prepare("SELECT b.id, b.prospect_id, b.version, b.status, b.generator, b.palette, b.voice, b.created_at, p.name, p.category, p.city FROM prospect_brand_audits b JOIN prospect_prospects p ON p.id = b.prospect_id ORDER BY b.created_at DESC LIMIT 100").all<{ id: string; prospect_id: string; version: number; status: string; generator: string; palette: string; voice: string | null; created_at: string; name: string; category: string; city: string }>();
  return results.map((r) => ({ ...r, palette: parseJson<string[]>(r.palette, []) }));
}

export async function listDemos(db: D1Binding) {
  const { results } = await db.prepare("SELECT d.id, d.prospect_id, d.version, d.status, d.view_count, d.last_viewed_at, d.access_expires_at, d.access_token_hash IS NOT NULL AS has_link, d.approved_by, d.created_at, p.name, p.status AS prospect_status FROM prospect_demos d JOIN prospect_prospects p ON p.id = d.prospect_id WHERE d.status != 'superseded' ORDER BY d.created_at DESC LIMIT 100").all<{ id: string; prospect_id: string; version: number; status: string; view_count: number; last_viewed_at: string | null; access_expires_at: string | null; has_link: number; approved_by: string | null; created_at: string; name: string; prospect_status: string }>();
  return results;
}

export async function listMessages(db: D1Binding, statuses: string[]) {
  const { results } = await db.prepare(`SELECT m.id, m.prospect_id, m.channel, m.step, m.recipient, m.subject, m.body, m.status, m.review, m.approved_by, m.sent_by, m.sent_at, m.created_at, p.name AS prospect_name FROM prospect_messages m JOIN prospect_prospects p ON p.id = m.prospect_id WHERE m.status IN (${statuses.map(() => "?").join(",")}) ORDER BY m.created_at DESC LIMIT 100`).bind(...statuses).all<Omit<MessageView, "review"> & { review: string | null }>();
  return results.map((m) => ({ ...m, review: parseJson<ReviewResult | null>(m.review, null) }));
}

export async function listCampaigns(db: D1Binding) {
  const { results } = await db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM prospect_prospects p WHERE p.campaign_id = c.id) AS prospects,
    (SELECT COUNT(*) FROM prospect_messages m WHERE m.campaign_id = c.id AND m.status = 'sent') AS sent,
    (SELECT COUNT(*) FROM prospect_prospects p WHERE p.campaign_id = c.id AND p.status IN ('replied','meeting','won')) AS responded
    FROM prospect_campaigns c ORDER BY c.created_at DESC`).all<{ id: string; name: string; city: string | null; zone: string | null; category: string | null; status: string; daily_contact_cap: number; notes: string | null; prospects: number; sent: number; responded: number }>();
  return results;
}

export async function listFollowUps(db: D1Binding, now: Date) {
  const staleBefore = new Date(now.getTime() - 5 * 86_400_000).toISOString();
  const [waiting, meetings] = await Promise.all([
    db.prepare(`SELECT p.id, p.name, p.status, p.city, MAX(m.sent_at) AS last_sent, (SELECT MAX(occurred_at) FROM prospect_activities a WHERE a.prospect_id = p.id) AS last_activity
      FROM prospect_prospects p JOIN prospect_messages m ON m.prospect_id = p.id AND m.status = 'sent' WHERE p.status IN ('contacted', 'replied') GROUP BY p.id ORDER BY last_sent`).all<{ id: string; name: string; status: string; city: string; last_sent: string; last_activity: string | null }>(),
    db.prepare("SELECT a.id, a.prospect_id, a.scheduled_at, a.summary, a.created_by, p.name, p.status FROM prospect_activities a JOIN prospect_prospects p ON p.id = a.prospect_id WHERE a.type = 'meeting' ORDER BY a.scheduled_at DESC LIMIT 50").all<{ id: string; prospect_id: string; scheduled_at: string | null; summary: string; created_by: string; name: string; status: string }>(),
  ]);
  return { waiting: waiting.results.map((w) => ({ ...w, due: (w.last_activity ?? w.last_sent) <= staleBefore })), meetings: meetings.results };
}

export async function listClients(db: D1Binding) {
  const { results } = await db.prepare("SELECT p.id, p.name, p.category, p.city, a.deal_value_mxn, a.occurred_at, a.summary, a.created_by FROM prospect_activities a JOIN prospect_prospects p ON p.id = a.prospect_id WHERE a.type = 'won' ORDER BY a.occurred_at DESC").all<{ id: string; name: string; category: string; city: string; deal_value_mxn: number | null; occurred_at: string; summary: string; created_by: string }>();
  return results;
}

export async function listSuppressions(db: D1Binding) {
  const { results } = await db.prepare("SELECT id, kind, value, reason, source, created_by, created_at FROM prospect_suppressions ORDER BY created_at DESC LIMIT 500").all<{ id: string; kind: string; value: string; reason: string; source: string; created_by: string; created_at: string }>();
  return results;
}

export async function usageSummary(db: D1Binding) {
  const [monthly, recent] = await Promise.all([
    db.prepare("SELECT substr(created_at, 1, 7) AS month, provider, operation, SUM(units) AS units, SUM(cost_usd_micros) AS micros FROM prospect_api_usage GROUP BY month, provider, operation ORDER BY month DESC, provider").all<{ month: string; provider: string; operation: string; units: number; micros: number }>(),
    db.prepare("SELECT u.id, u.provider, u.operation, u.cost_usd_micros, u.created_at, p.name FROM prospect_api_usage u LEFT JOIN prospect_prospects p ON p.id = u.prospect_id ORDER BY u.created_at DESC LIMIT 50").all<{ id: string; provider: string; operation: string; cost_usd_micros: number; created_at: string; name: string | null }>(),
  ]);
  return { monthly: monthly.results, recent: recent.results };
}

export async function listAudit(db: D1Binding, limit = 200) {
  const { results } = await db.prepare(`SELECT id, action, entity_type, entity_id, payload, created_at FROM audit_logs WHERE entity_type IN ${PROSPECT_ENTITY_TYPES} ORDER BY created_at DESC, rowid DESC LIMIT ?`).bind(limit).all<{ id: string; action: string; entity_type: string; entity_id: string; payload: string; created_at: string }>();
  return results.map((r) => ({ ...r, payload: parseJson<Record<string, unknown>>(r.payload, {}) }));
}

export async function getSettings(db: D1Binding) {
  const [agents, budgets, team, jobs] = await Promise.all([
    Promise.all(AGENTS.map((agent) => getAgentConfig(db, agent))),
    db.prepare("SELECT provider, monthly_limit_usd_cents, enabled, updated_by, updated_at FROM prospect_provider_budgets").all<{ provider: string; monthly_limit_usd_cents: number; enabled: number; updated_by: string; updated_at: string }>(),
    db.prepare("SELECT t.email, t.role, t.active, t.added_by, t.updated_at, a.email IS NOT NULL AS has_account, a.last_login_at FROM prospect_team t LEFT JOIN staff_accounts a ON a.email = t.email ORDER BY t.email").all<{ email: string; role: string; active: number; added_by: string; updated_at: string; has_account: number; last_login_at: string | null }>(),
    db.prepare("SELECT agent, status, COUNT(*) AS n FROM prospect_jobs GROUP BY agent, status").all<{ agent: string; status: string; n: number }>(),
  ]);
  return { agents, budgets: budgets.results, team: team.results, jobs: jobs.results };
}
