import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import type { D1Binding, D1Statement, R2Binding } from "@/lib/runtime-bindings";
import { deterministicBrief, llmBrief, LlmCostError, SYNTHETIC_LABEL, type BrandBrief } from "./brief";
import { assertWithinBudget, type BudgetRow, ESTIMATED_COST_MICROS, monthStart, type Provider } from "./budget";
import { renderDemo } from "./demo";
import { resolveImageProvider } from "./images";
import { dedupeKey, normalizeEmail, normalizePhone, registrableDomain, requireHttpUrl } from "./normalize";
import { draftOutreach, renderWithLink } from "./outreach";
import { PLACES_RETENTION_DAYS, searchPlaces } from "./places";
import { reviewMessage, suppressionKeys, type ReviewResult } from "./reviewer";
import type { activitySchema, agentConfigSchema, budgetSchema, campaignSchema, discoverSchema, draftSchema, messagePatchSchema, ProspectInput, suppressionSchema, teamSchema } from "./schemas";
import { prospectPatchSchema } from "./schemas";
import { calculateScore, DEFAULT_QUALIFY_THRESHOLD } from "./scoring";
import { safeFetchText } from "./ssrf";
import { createAccessToken, expiresAt, hashToken, isWellFormedToken } from "./tokens";
import { type Actor, actorId, type AgentName, type Channel, type ProspectRow, type ProspectStatus, ProspectError, type Role, roleAtLeast, type Signals, type SuppressionKind } from "./types";
import { analyzeWebsite, NO_WEBSITE_PRESENCE_GAP, type WebsiteAnalysis } from "./website-analyzer";
import { assertTransition } from "./workflow";

export type ProspectEnv = {
  GOOGLE_PLACES_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  SITE_URL: string;
};

export type ProspectContext = {
  db: D1Binding;
  r2?: R2Binding | null;
  actor: Extract<Actor, { kind: "human" }>;
  env: ProspectEnv;
  now?: () => Date;
  fetchImpl?: typeof fetch;
  resolver?: (hostname: string) => Promise<string[]>;
  anthropic?: Anthropic;
};

const now = (ctx: Pick<ProspectContext, "now">) => (ctx.now ? ctx.now() : new Date());
const iso = (ctx: Pick<ProspectContext, "now">) => now(ctx).toISOString();
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
const json = (value: unknown) => JSON.stringify(value ?? null);
export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function requireRole(actor: Actor, minimum: Role) {
  if (actor.kind !== "human" || !roleAtLeast(actor.role, minimum)) throw new ProspectError("No tienes permiso para esta acción.", 403, "forbidden");
}

function agentActor(ctx: ProspectContext, agent: AgentName): Actor {
  return { kind: "agent", agent, onBehalfOf: ctx.actor.email };
}

// ---------------------------------------------------------------------------
// Auditoría: cada escritura relevante deja rastro en `audit_logs` (tabla existente).
// ---------------------------------------------------------------------------

function auditStatement(ctx: ProspectContext, actor: Actor, action: string, entityType: string, entityId: string, payload: Record<string, unknown> = {}, onlyIfChanged = false) {
  const sql = onlyIfChanged
    ? "INSERT INTO audit_logs (id, profile_id, action, entity_type, entity_id, payload, created_at) SELECT ?, NULL, ?, ?, ?, ?, ? WHERE changes() > 0"
    : "INSERT INTO audit_logs (id, profile_id, action, entity_type, entity_id, payload, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?)";
  return ctx.db.prepare(sql).bind(uid("aud"), action, entityType, entityId, json({ actor: actorId(actor), ...payload }), iso(ctx));
}

async function audit(ctx: ProspectContext, actor: Actor, action: string, entityType: string, entityId: string, payload: Record<string, unknown> = {}) {
  await auditStatement(ctx, actor, action, entityType, entityId, payload).run();
}

/**
 * Guarda transaccional: si la sentencia condicional previa no modificó filas, `json()` sobre texto
 * inválido lanza un error y D1 revierte el lote completo; así las sentencias extra nunca quedan huérfanas.
 */
const STALE_GUARD = "SELECT CASE WHEN changes() = 0 THEN json('prospect_stale_guard') ELSE 1 END";

/** Ejecuta un cambio condicional, su auditoría y efectos dependientes en una sola transacción. */
async function atomic(ctx: ProspectContext, change: D1Statement, auditStmt: D1Statement, extra: D1Statement[] = [], guard = extra.length > 0) {
  const statements = guard ? [change, ctx.db.prepare(STALE_GUARD), auditStmt, ...extra] : [change, auditStmt, ...extra];
  try {
    const results = await ctx.db.batch(statements);
    return results[0]?.meta?.changes ?? 0;
  } catch (error) {
    if (guard && /malformed JSON/i.test(String(error))) return 0;
    throw error;
  }
}

async function transition(ctx: ProspectContext, prospect: ProspectRow, to: ProspectStatus, actor: Actor, reason: string, extra: D1Statement[] = []) {
  if (prospect.status === to) return;
  assertTransition(prospect.status, to, actor);
  const change = ctx.db.prepare("UPDATE prospect_prospects SET status = ?, updated_at = ? WHERE id = ? AND status = ?").bind(to, iso(ctx), prospect.id, prospect.status);
  const changed = await atomic(ctx, change, auditStatement(ctx, actor, "prospect.transition", "prospect", prospect.id, { from: prospect.status, to, reason }, true), extra);
  if (changed !== 1) throw new ProspectError("El prospecto cambió mientras se procesaba la solicitud. Recarga e intenta de nuevo.", 409, "stale");
  prospect.status = to;
}

// ---------------------------------------------------------------------------
// Configuración, presupuestos y trabajos idempotentes
// ---------------------------------------------------------------------------

export type AgentConfig = { agent: AgentName; enabled: boolean; provider: string; model: string | null; settings: { threshold?: number; effort?: "low" | "medium" | "high"; imageProvider?: string; imageModel?: string; senderName?: string } };

const DEFAULT_AGENT_CONFIG: Record<AgentName, Omit<AgentConfig, "agent">> = {
  researcher: { enabled: true, provider: "google_places", model: null, settings: {} },
  qualifier: { enabled: true, provider: "deterministic", model: null, settings: { threshold: DEFAULT_QUALIFY_THRESHOLD } },
  brand_analyst: { enabled: true, provider: "deterministic", model: null, settings: {} },
  creative: { enabled: true, provider: "deterministic", model: "claude-opus-5-5", settings: { effort: "medium", imageProvider: "none" } },
  demo_builder: { enabled: true, provider: "deterministic", model: null, settings: {} },
  outreach_writer: { enabled: true, provider: "deterministic", model: null, settings: { senderName: "Equipo Punto Digital" } },
  reviewer: { enabled: true, provider: "deterministic", model: null, settings: {} },
};

export async function getAgentConfig(db: D1Binding, agent: AgentName): Promise<AgentConfig> {
  const row = await db.prepare("SELECT enabled, provider, model, settings FROM prospect_agent_configs WHERE agent = ?").bind(agent).first<{ enabled: number; provider: string; model: string | null; settings: string }>();
  const fallback = DEFAULT_AGENT_CONFIG[agent];
  if (!row) return { agent, ...fallback };
  return { agent, enabled: Boolean(row.enabled), provider: row.provider, model: row.model ?? fallback.model, settings: { ...fallback.settings, ...parseJson(row.settings, {}) } };
}

async function requireAgent(ctx: ProspectContext, agent: AgentName) {
  const config = await getAgentConfig(ctx.db, agent);
  if (!config.enabled) throw new ProspectError("Este agente está deshabilitado en Configuración.", 409, "agent_disabled");
  return config;
}

async function checkBudget(ctx: ProspectContext, provider: Provider, estimateMicros: number) {
  const budget = await ctx.db.prepare("SELECT provider, monthly_limit_usd_cents, enabled FROM prospect_provider_budgets WHERE provider = ?").bind(provider).first<BudgetRow>();
  const spend = await ctx.db.prepare("SELECT COALESCE(SUM(cost_usd_micros), 0) AS total FROM prospect_api_usage WHERE provider = ? AND created_at >= ?").bind(provider, monthStart(now(ctx))).first<{ total: number }>();
  assertWithinBudget(provider, budget, spend?.total ?? 0, estimateMicros);
}

async function recordUsage(ctx: ProspectContext, provider: Provider, operation: string, costMicros: number, prospectId: string | null, jobId: string | null, units = 1) {
  await ctx.db.prepare("INSERT INTO prospect_api_usage (id, provider, operation, units, cost_usd_micros, prospect_id, job_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(uid("use"), provider, operation, units, Math.ceil(costMicros), prospectId, jobId, iso(ctx)).run();
}

type JobRow = { id: string; status: string; output: string | null; attempts: number };

/**
 * Idempotencia y reintentos: la misma `requestKey` nunca ejecuta dos veces un trabajo exitoso;
 * un trabajo fallido puede reintentarse con la misma clave (incrementa `attempts`).
 */
async function runJob<T>(ctx: ProspectContext, agent: AgentName, prospectId: string | null, requestKey: string, input: unknown, work: (jobId: string) => Promise<T>): Promise<T> {
  const key = `${agent}:${prospectId ?? "-"}:${requestKey}`;
  const id = uid("job");
  await ctx.db.prepare("INSERT OR IGNORE INTO prospect_jobs (id, agent, prospect_id, idempotency_key, status, attempts, input, started_at, created_by) VALUES (?, ?, ?, ?, 'running', 1, ?, ?, ?)").bind(id, agent, prospectId, key, json(input), iso(ctx), ctx.actor.email).run();
  const job = await ctx.db.prepare("SELECT id, status, output, attempts FROM prospect_jobs WHERE idempotency_key = ?").bind(key).first<JobRow>();
  if (!job) throw new ProspectError("No se pudo registrar el trabajo.", 500, "job_error");
  if (job.id !== id) {
    if (job.status === "succeeded") return parseJson<T>(job.output, null as T);
    if (job.status === "running") throw new ProspectError("Esta solicitud ya se está procesando.", 409, "in_progress");
    const retried = await ctx.db.prepare("UPDATE prospect_jobs SET status = 'running', attempts = attempts + 1, error = NULL, started_at = ? WHERE id = ? AND status = 'failed' AND attempts < 3").bind(iso(ctx), job.id).run();
    if ((retried.meta?.changes ?? 0) !== 1) throw new ProspectError("Se agotaron los reintentos para esta solicitud.", 409, "retries_exhausted");
  }
  try {
    const output = await work(job.id);
    await ctx.db.prepare("UPDATE prospect_jobs SET status = 'succeeded', output = ?, finished_at = ? WHERE id = ?").bind(json(output), iso(ctx), job.id).run();
    return output;
  } catch (error) {
    const message = error instanceof ProspectError ? error.message : "Error interno";
    await ctx.db.prepare("UPDATE prospect_jobs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?").bind(message.slice(0, 500), iso(ctx), job.id).run();
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Prospectos
// ---------------------------------------------------------------------------

export async function getProspect(db: D1Binding, id: string) {
  const row = await db.prepare("SELECT * FROM prospect_prospects WHERE id = ? AND deleted_at IS NULL").bind(id).first<ProspectRow>();
  if (!row) throw new ProspectError("Prospecto no encontrado.", 404, "not_found");
  return row;
}

export async function findSuppressions(db: D1Binding, keys: Array<{ kind: SuppressionKind; value: string }>) {
  if (keys.length === 0) return [];
  const clauses = keys.map(() => "(kind = ? AND value = ?)").join(" OR ");
  const { results } = await db.prepare(`SELECT kind, value FROM prospect_suppressions WHERE ${clauses}`).bind(...keys.flatMap((key) => [key.kind, key.value])).all<{ kind: SuppressionKind; value: string }>();
  return results;
}

async function qualifierThreshold(db: D1Binding) {
  return (await getAgentConfig(db, "qualifier")).settings.threshold ?? DEFAULT_QUALIFY_THRESHOLD;
}

function hasContactChannel(p: Pick<ProspectRow, "email_public" | "phone_public" | "instagram_url">) {
  return Boolean(p.email_public || p.phone_public || p.instagram_url);
}

type CreateResult = { id: string; created: boolean; reason?: "duplicate" | "suppressed" };

async function insertProspect(ctx: ProspectContext, input: ProspectInput & { googlePlaceId?: string | null; source: string; placesExpiresAt?: string | null }, actor: Actor, evidence: { kind: string; data: unknown }): Promise<CreateResult> {
  const website = input.website ? requireHttpUrl(input.website, "website") : null;
  const sourceUrl = requireHttpUrl(input.sourceUrl, "sourceUrl");
  const email = normalizeEmail(input.emailPublic);
  const probe = { status: "discovered" as ProspectStatus, name: input.name, website, email_public: email, phone_public: input.phonePublic ?? null, instagram_url: input.instagramUrl ?? null, google_place_id: input.googlePlaceId ?? null };
  const key = dedupeKey({ name: input.name, city: input.city, website, googlePlaceId: input.googlePlaceId });
  const existing = await ctx.db.prepare("SELECT id FROM prospect_prospects WHERE dedupe_key = ? OR (google_place_id IS NOT NULL AND google_place_id = ?)").bind(key, input.googlePlaceId ?? "").first<{ id: string }>();
  if (existing) return { id: existing.id, created: false, reason: "duplicate" };
  if ((await findSuppressions(ctx.db, suppressionKeys(probe))).length) return { id: "", created: false, reason: "suppressed" };
  const signals: Signals = input.signals ?? {};
  const score = calculateScore(signals, { threshold: await qualifierThreshold(ctx.db), hasContactChannel: hasContactChannel(probe) });
  const id = uid("pro");
  const at = iso(ctx);
  const insert = ctx.db.prepare(`INSERT OR IGNORE INTO prospect_prospects (id, name, category, city, zone, address, website, website_domain, email_public, phone_public, instagram_url, facebook_url, google_place_id, source, source_url, source_checked_at, places_content_expires_at, status, score, score_breakdown, missing_evidence, signals, campaign_id, notes, dedupe_key, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'discovered', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, input.name, input.category, input.city, input.zone ?? null, input.address ?? null, website, registrableDomain(website), email, input.phonePublic ?? null, input.instagramUrl ?? null, input.facebookUrl ?? null, input.googlePlaceId ?? null, input.source, sourceUrl, at, input.placesExpiresAt ?? null, score.score, json(score.lines), json(score.missing), json(signals), input.campaignId ?? null, input.notes ?? null, key, actorId(actor), at, at);
  const evidenceStmt = ctx.db.prepare("INSERT INTO prospect_evidence (id, prospect_id, kind, source_url, observed_at, data, created_by, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM prospect_prospects WHERE id = ?)").bind(uid("evi"), id, evidence.kind, sourceUrl, at, json(evidence.data), actorId(actor), at, id);
  const changed = await atomic(ctx, insert, auditStatement(ctx, actor, "prospect.created", "prospect", id, { source: input.source, sourceUrl }, true), [evidenceStmt], false);
  if (changed !== 1) return { id: "", created: false, reason: "duplicate" };
  return { id, created: true };
}

export async function createProspect(ctx: ProspectContext, input: ProspectInput) {
  requireRole(ctx.actor, "operator");
  return insertProspect(ctx, { ...input, source: "manual" }, ctx.actor, { kind: "manual", data: { note: "Alta manual con fuente declarada", sourceUrl: input.sourceUrl } });
}

export async function importProspects(ctx: ProspectContext, items: ProspectInput[]) {
  requireRole(ctx.actor, "operator");
  const results: CreateResult[] = [];
  for (const item of items) results.push(await insertProspect(ctx, { ...item, source: "import" }, ctx.actor, { kind: "import", data: { sourceUrl: item.sourceUrl } }));
  return { created: results.filter((r) => r.created).length, duplicates: results.filter((r) => r.reason === "duplicate").length, suppressed: results.filter((r) => r.reason === "suppressed").length, results };
}

/** Agente investigador: descubrimiento geográfico por giro con Google Places. */
export async function discover(ctx: ProspectContext, query: z.infer<typeof discoverSchema>, requestKey: string) {
  requireRole(ctx.actor, "operator");
  await requireAgent(ctx, "researcher");
  const actor = agentActor(ctx, "researcher");
  return runJob(ctx, "researcher", null, requestKey, query, async (jobId) => {
    await checkBudget(ctx, "google_places", ESTIMATED_COST_MICROS.google_places_text_search);
    const candidates = await searchPlaces(query, ctx.env.GOOGLE_PLACES_API_KEY ?? "", ctx.fetchImpl);
    await recordUsage(ctx, "google_places", "text_search", ESTIMATED_COST_MICROS.google_places_text_search, null, jobId);
    const expires = new Date(now(ctx).getTime() + PLACES_RETENTION_DAYS * 86_400_000).toISOString();
    const outcome = { found: candidates.length, created: 0, duplicates: 0, suppressed: 0, ids: [] as string[] };
    for (const place of candidates) {
      const website = place.website && /^https?:\/\//i.test(place.website) ? place.website : null;
      const result = await insertProspect(ctx, { name: place.name, category: query.category, city: query.city, zone: query.zone ?? null, address: place.address, sourceUrl: place.mapsUrl, website, phonePublic: place.phone, googlePlaceId: place.placeId, campaignId: query.campaignId ?? null, source: "google_places", placesExpiresAt: expires, emailPublic: null, instagramUrl: null, facebookUrl: null, notes: null }, actor, { kind: "places", data: { placeId: place.placeId, primaryType: place.primaryType, query } });
      if (result.created) {
        outcome.created += 1;
        outcome.ids.push(result.id);
      } else if (result.reason === "duplicate") outcome.duplicates += 1;
      else outcome.suppressed += 1;
    }
    return outcome;
  });
}

export async function updateProspect(ctx: ProspectContext, id: string, patch: z.infer<typeof prospectPatchSchema>) {
  requireRole(ctx.actor, "operator");
  const prospect = await getProspect(ctx.db, id);
  if (prospect.status === "suppressed") throw new ProspectError("El prospecto está excluido.", 409, "suppressed");
  const signals: Signals = { ...parseJson<Signals>(prospect.signals, {}), ...(patch.signals ?? {}) };
  const next = {
    name: patch.name ?? prospect.name,
    category: patch.category ?? prospect.category,
    city: patch.city ?? prospect.city,
    zone: patch.zone !== undefined ? patch.zone : prospect.zone,
    address: patch.address !== undefined ? patch.address : prospect.address,
    website: patch.website !== undefined ? patch.website : prospect.website,
    email_public: patch.emailPublic !== undefined ? normalizeEmail(patch.emailPublic) : prospect.email_public,
    phone_public: patch.phonePublic !== undefined ? patch.phonePublic : prospect.phone_public,
    instagram_url: patch.instagramUrl !== undefined ? patch.instagramUrl : prospect.instagram_url,
    facebook_url: patch.facebookUrl !== undefined ? patch.facebookUrl : prospect.facebook_url,
    notes: patch.notes !== undefined ? patch.notes : prospect.notes,
    campaign_id: patch.campaignId !== undefined ? patch.campaignId : prospect.campaign_id,
  };
  const score = calculateScore(signals, { threshold: await qualifierThreshold(ctx.db), hasContactChannel: hasContactChannel(next) });
  const change = ctx.db.prepare("UPDATE prospect_prospects SET name = ?, category = ?, city = ?, zone = ?, address = ?, website = ?, website_domain = ?, email_public = ?, phone_public = ?, instagram_url = ?, facebook_url = ?, notes = ?, campaign_id = ?, signals = ?, score = ?, score_breakdown = ?, missing_evidence = ?, updated_at = ? WHERE id = ? AND updated_at = ?")
    .bind(next.name, next.category, next.city, next.zone, next.address, next.website, registrableDomain(next.website), next.email_public, next.phone_public, next.instagram_url, next.facebook_url, next.notes, next.campaign_id, json(signals), score.score, json(score.lines), json(score.missing), iso(ctx), id, prospect.updated_at);
  const changed = await atomic(ctx, change, auditStatement(ctx, ctx.actor, "prospect.updated", "prospect", id, { fields: Object.keys(patch) }, true));
  if (changed !== 1) throw new ProspectError("El prospecto cambió mientras se editaba. Recarga e intenta de nuevo.", 409, "stale");
  return { id, score: score.score };
}

/** Agente calificador. */
export async function qualify(ctx: ProspectContext, id: string) {
  requireRole(ctx.actor, "operator");
  await requireAgent(ctx, "qualifier");
  const prospect = await getProspect(ctx.db, id);
  const actor = agentActor(ctx, "qualifier");
  const result = calculateScore(parseJson<Signals>(prospect.signals, {}), { threshold: await qualifierThreshold(ctx.db), hasContactChannel: hasContactChannel(prospect) });
  await ctx.db.prepare("UPDATE prospect_prospects SET score = ?, score_breakdown = ?, missing_evidence = ?, updated_at = ? WHERE id = ?").bind(result.score, json(result.lines), json(result.missing), iso(ctx), id).run();
  await audit(ctx, actor, "prospect.scored", "prospect", id, { score: result.score, missing: result.missing, eligible: result.eligible });
  if (result.eligible && prospect.status === "discovered") await transition(ctx, prospect, "qualified", actor, `Puntaje ${result.score} ≥ ${result.threshold}`);
  if (!result.eligible && prospect.status === "qualified") await transition(ctx, prospect, "discovered", actor, `Puntaje ${result.score} < ${result.threshold} o sin canal de contacto`);
  return { ...result, status: prospect.status };
}

/** Agente analista de marca: lectura del sitio público con protección SSRF. */
export async function analyzeProspectWebsite(ctx: ProspectContext, id: string, requestKey: string) {
  requireRole(ctx.actor, "operator");
  await requireAgent(ctx, "brand_analyst");
  const prospect = await getProspect(ctx.db, id);
  const actor = agentActor(ctx, "brand_analyst");
  return runJob(ctx, "brand_analyst", id, requestKey, { website: prospect.website }, async () => {
    const signals = parseJson<Signals>(prospect.signals, {});
    if (!prospect.website) {
      if (signals.presence_gap == null) signals.presence_gap = NO_WEBSITE_PRESENCE_GAP;
      await ctx.db.prepare("UPDATE prospect_prospects SET signals = ?, updated_at = ? WHERE id = ?").bind(json(signals), iso(ctx), id).run();
      await audit(ctx, actor, "prospect.analyzed", "prospect", id, { website: null, presenceGap: signals.presence_gap });
      return { analyzed: false, reason: "Sin sitio web registrado: brecha de presencia sugerida 5/5." };
    }
    const page = await safeFetchText(prospect.website, { fetchImpl: ctx.fetchImpl, resolver: ctx.resolver });
    const analysis = analyzeWebsite(page.body, page.finalUrl);
    if (signals.presence_gap == null) signals.presence_gap = analysis.suggestedPresenceGap;
    const at = iso(ctx);
    await ctx.db.batch([
      ctx.db.prepare("INSERT INTO prospect_evidence (id, prospect_id, kind, source_url, observed_at, data, created_by, created_at) VALUES (?, ?, 'website', ?, ?, ?, ?, ?)").bind(uid("evi"), id, page.finalUrl, at, json(analysis), actorId(actor), at),
      ctx.db.prepare("UPDATE prospect_prospects SET signals = ?, instagram_url = COALESCE(instagram_url, ?), facebook_url = COALESCE(facebook_url, ?), tiktok_url = COALESCE(tiktok_url, ?), email_public = COALESCE(email_public, ?), updated_at = ? WHERE id = ?")
        .bind(json(signals), analysis.social.instagram, analysis.social.facebook, analysis.social.tiktok, analysis.businessEmails[0] ?? null, at, id),
      auditStatement(ctx, actor, "prospect.analyzed", "prospect", id, { url: page.finalUrl, issues: analysis.issues.length, truncated: page.truncated }),
    ]);
    return { analyzed: true, issues: analysis.issues, palette: analysis.palette, social: analysis.social };
  });
}

async function latestWebsiteAnalysis(db: D1Binding, id: string) {
  const row = await db.prepare("SELECT data FROM prospect_evidence WHERE prospect_id = ? AND kind = 'website' ORDER BY observed_at DESC LIMIT 1").bind(id).first<{ data: string }>();
  return parseJson<WebsiteAnalysis | null>(row?.data, null);
}

export async function latestBrandAudit(db: D1Binding, id: string) {
  return db.prepare("SELECT * FROM prospect_brand_audits WHERE prospect_id = ? ORDER BY version DESC LIMIT 1").bind(id).first<{ id: string; version: number; brief: string; palette: string; generator: string; created_at: string; asset_prompts: string; claims_to_verify: string; status: string; voice: string | null; logo_license: string }>();
}

/** Agente creativo (brief). Claude opcional con presupuesto; si no, brief determinista. */
export async function generateBrief(ctx: ProspectContext, id: string, options: { useLlm?: boolean }, requestKey: string) {
  requireRole(ctx.actor, "operator");
  const config = await requireAgent(ctx, "creative");
  const prospect = await getProspect(ctx.db, id);
  if (prospect.status === "suppressed") throw new ProspectError("El prospecto está excluido.", 409, "suppressed");
  const actor = agentActor(ctx, "creative");
  return runJob(ctx, "creative", id, requestKey, options, async (jobId) => {
    const analysis = await latestWebsiteAnalysis(ctx.db, id);
    const input = { name: prospect.name, category: prospect.category, city: prospect.city, zone: prospect.zone, website: prospect.website, instagramUrl: prospect.instagram_url, analysis };
    let brief: BrandBrief;
    let generator = "deterministic:v1";
    const wantsLlm = options.useLlm ?? config.provider === "anthropic";
    if (wantsLlm) {
      if (!ctx.env.ANTHROPIC_API_KEY) throw new ProspectError("Falta ANTHROPIC_API_KEY para generar el brief con Claude.", 503, "missing_credentials");
      await checkBudget(ctx, "anthropic", ESTIMATED_COST_MICROS.anthropic_brief_ceiling);
      const model = config.model ?? "claude-opus-5-5";
      try {
        const result = await llmBrief(input, { apiKey: ctx.env.ANTHROPIC_API_KEY, model, effort: config.settings.effort ?? "medium" }, ctx.anthropic);
        await recordUsage(ctx, "anthropic", "brand_brief", result.costMicros, id, jobId);
        brief = result.brief;
        generator = `anthropic:${result.model}`;
      } catch (error) {
        if (error instanceof LlmCostError) await recordUsage(ctx, "anthropic", "brand_brief_failed", error.costMicros, id, jobId);
        throw error;
      }
    } else {
      brief = deterministicBrief(input);
    }
    const version = ((await latestBrandAudit(ctx.db, id))?.version ?? 0) + 1;
    const auditId = uid("bra");
    const at = iso(ctx);
    await ctx.db.batch([
      ctx.db.prepare("INSERT INTO prospect_brand_audits (id, prospect_id, version, status, sources, palette, voice, logo_license, brief, claims_to_verify, asset_prompts, generator, created_by, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, ?, ?, 'unknown', ?, ?, ?, ?, ?, ?, ?)")
        .bind(auditId, id, version, json([prospect.source_url, prospect.website, analysis?.url].filter(Boolean)), json(brief.palette), brief.voice, json(brief), json(brief.claimsToVerify), json(brief.assetPrompts), generator, actorId(actor), at, at),
      auditStatement(ctx, actor, "brand.brief_created", "prospect", id, { brandAuditId: auditId, version, generator }),
    ]);
    return { brandAuditId: auditId, version, generator };
  });
}

/** Agente creativo (imágenes). Proveedor configurable; deshabilitado por defecto. */
export async function generateImages(ctx: ProspectContext, id: string, count: number, requestKey: string) {
  requireRole(ctx.actor, "operator");
  const config = await requireAgent(ctx, "creative");
  const provider = resolveImageProvider(config.settings.imageProvider ?? "none", ctx.env, config.settings.imageModel);
  if (!provider) throw new ProspectError("No hay proveedor de imágenes configurado. Actívalo en Configuración → Agentes.", 409, "no_image_provider");
  if (!ctx.r2) throw new ProspectError("El almacenamiento R2 no está disponible en este entorno.", 503, "no_storage");
  const brandAudit = await latestBrandAudit(ctx.db, id);
  if (!brandAudit) throw new ProspectError("Primero genera el brief de marca.", 409, "missing_brief");
  const prompts = parseJson<string[]>(brandAudit.asset_prompts, []).slice(0, count);
  const actor = agentActor(ctx, "creative");
  return runJob(ctx, "creative", id, `images:${requestKey}`, { count, brandAuditId: brandAudit.id }, async (jobId) => {
    const created: string[] = [];
    for (const prompt of prompts) {
      await checkBudget(ctx, "openai_images", ESTIMATED_COST_MICROS.openai_image_1024);
      const image = await provider.generate(prompt);
      await recordUsage(ctx, "openai_images", "image_generation", image.costMicros, id, jobId);
      const assetId = uid("ast");
      const key = `prospect/${id}/${assetId}-${crypto.randomUUID()}.png`;
      await ctx.r2!.put(key, image.bytes, { httpMetadata: { contentType: image.mimeType } });
      await ctx.db.prepare("INSERT INTO prospect_assets (id, prospect_id, brand_audit_id, storage_key, mime_type, prompt, provider, model, synthetic_label, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)")
        .bind(assetId, id, brandAudit.id, key, image.mimeType, prompt, provider.id, image.model, SYNTHETIC_LABEL, actorId(actor), iso(ctx)).run();
      created.push(assetId);
    }
    await audit(ctx, actor, "brand.images_generated", "prospect", id, { count: created.length, provider: provider.id });
    return { assets: created };
  });
}

/** Agente constructor de demos. Solo prospectos calificados. */
export async function buildDemo(ctx: ProspectContext, id: string) {
  requireRole(ctx.actor, "operator");
  await requireAgent(ctx, "demo_builder");
  const prospect = await getProspect(ctx.db, id);
  if (!["qualified", "demo_ready"].includes(prospect.status)) throw new ProspectError("Solo un prospecto calificado puede tener demo.", 409, "not_qualified");
  const brandAudit = await latestBrandAudit(ctx.db, id);
  if (!brandAudit) throw new ProspectError("Primero genera el brief de marca.", 409, "missing_brief");
  const actor = agentActor(ctx, "demo_builder");
  const brief = parseJson<BrandBrief>(brandAudit.brief, deterministicBrief({ name: prospect.name, category: prospect.category, city: prospect.city, zone: prospect.zone, website: prospect.website, instagramUrl: prospect.instagram_url, analysis: null }));
  const { results: assets } = await ctx.db.prepare("SELECT id FROM prospect_assets WHERE brand_audit_id = ? ORDER BY created_at LIMIT 9").bind(brandAudit.id).all<{ id: string }>();
  const version = ((await ctx.db.prepare("SELECT MAX(version) AS v FROM prospect_demos WHERE prospect_id = ?").bind(id).first<{ v: number | null }>())?.v ?? 0) + 1;
  const demoId = uid("dem");
  const at = iso(ctx);
  const html = renderDemo({ prospect, brief, imageUrls: assets.map((asset) => `img/${asset.id}`), generatedAt: at });
  await ctx.db.batch([
    ctx.db.prepare("UPDATE prospect_demos SET status = 'superseded', access_token_hash = NULL, updated_at = ? WHERE prospect_id = ? AND status IN ('draft', 'approved')").bind(at, id),
    ctx.db.prepare("INSERT INTO prospect_demos (id, prospect_id, brand_audit_id, version, status, html, assets, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)").bind(demoId, id, brandAudit.id, version, html, json(assets.map((a) => a.id)), actorId(actor), at, at),
    auditStatement(ctx, actor, "demo.created", "prospect", id, { demoId, version, assets: assets.length }),
  ]);
  if (prospect.status === "qualified") await transition(ctx, prospect, "demo_ready", actor, `Demo v${version} creada`);
  return { demoId, version };
}

type DemoRow = { id: string; prospect_id: string; status: string; html: string; access_token_hash: string | null; access_expires_at: string | null; assets: string };

async function getDemo(db: D1Binding, demoId: string) {
  const demo = await db.prepare("SELECT id, prospect_id, status, html, access_token_hash, access_expires_at, assets FROM prospect_demos WHERE id = ?").bind(demoId).first<DemoRow>();
  if (!demo) throw new ProspectError("Demo no encontrada.", 404, "not_found");
  return demo;
}

/** Aprobación humana del prospecto y su demo vigente. Ningún agente puede ejecutarla. */
export async function approveProspect(ctx: ProspectContext, id: string) {
  requireRole(ctx.actor, "reviewer");
  const prospect = await getProspect(ctx.db, id);
  const demo = await ctx.db.prepare("SELECT id FROM prospect_demos WHERE prospect_id = ? AND status = 'draft' ORDER BY version DESC LIMIT 1").bind(id).first<{ id: string }>();
  if (!demo) throw new ProspectError("No hay una demo pendiente de aprobación.", 409, "missing_demo");
  const brandAudit = await latestBrandAudit(ctx.db, id);
  const at = iso(ctx);
  await transition(ctx, prospect, "approved", ctx.actor, "Aprobación humana de prospecto y demo", [
    ctx.db.prepare("UPDATE prospect_demos SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ? AND status = 'draft'").bind(ctx.actor.email, at, at, demo.id),
    ctx.db.prepare("UPDATE prospect_assets SET status = 'approved' WHERE brand_audit_id = ?").bind(brandAudit?.id ?? ""),
    ctx.db.prepare("UPDATE prospect_brand_audits SET status = 'reviewed', updated_at = ? WHERE id = ?").bind(at, brandAudit?.id ?? ""),
  ]);
  return { approved: true, demoId: demo.id };
}

/** Emite un enlace privado nuevo (rota el anterior). El token se muestra una sola vez. */
export async function issueDemoLink(ctx: ProspectContext, demoId: string) {
  requireRole(ctx.actor, "reviewer");
  const demo = await getDemo(ctx.db, demoId);
  if (demo.status !== "approved") throw new ProspectError("Solo una demo aprobada puede compartirse.", 409, "not_approved");
  const prospect = await getProspect(ctx.db, demo.prospect_id);
  if (prospect.status === "suppressed") throw new ProspectError("El prospecto está excluido.", 409, "suppressed");
  const token = createAccessToken();
  const expiry = expiresAt(now(ctx));
  await atomic(ctx, ctx.db.prepare("UPDATE prospect_demos SET access_token_hash = ?, access_expires_at = ?, updated_at = ? WHERE id = ? AND status = 'approved'").bind(await hashToken(token), expiry, iso(ctx), demoId), auditStatement(ctx, ctx.actor, "demo.link_issued", "demo", demoId, { expiresAt: expiry }, true));
  return { url: `${ctx.env.SITE_URL.replace(/\/$/, "")}/propuesta/${token}`, expiresAt: expiry };
}

export async function revokeDemo(ctx: ProspectContext, demoId: string) {
  requireRole(ctx.actor, "reviewer");
  const demo = await getDemo(ctx.db, demoId);
  const prospect = await getProspect(ctx.db, demo.prospect_id);
  await atomic(ctx, ctx.db.prepare("UPDATE prospect_demos SET status = 'revoked', access_token_hash = NULL, updated_at = ? WHERE id = ? AND status != 'revoked'").bind(iso(ctx), demoId), auditStatement(ctx, ctx.actor, "demo.revoked", "demo", demoId, {}, true));
  if (prospect.status === "approved") await transition(ctx, prospect, "demo_ready", ctx.actor, "Demo revocada");
  return { revoked: true };
}

/** Acceso público por token: demo aprobada, vigente y prospecto no excluido. */
export async function resolveDemoByToken(db: D1Binding, token: string, at: Date) {
  if (!isWellFormedToken(token)) return null;
  const demo = await db.prepare("SELECT d.id, d.html, d.assets, d.access_expires_at FROM prospect_demos d JOIN prospect_prospects p ON p.id = d.prospect_id WHERE d.access_token_hash = ? AND d.status = 'approved' AND p.status != 'suppressed'").bind(await hashToken(token)).first<{ id: string; html: string; assets: string; access_expires_at: string | null }>();
  if (!demo || !demo.access_expires_at || new Date(demo.access_expires_at) <= at) return null;
  return demo;
}

export async function recordDemoView(db: D1Binding, demoId: string, at: Date) {
  await db.prepare("UPDATE prospect_demos SET view_count = view_count + 1, last_viewed_at = ? WHERE id = ?").bind(at.toISOString(), demoId).run();
}

// ---------------------------------------------------------------------------
// Mensajes: borrador → revisión automática → aprobación humana → envío manual registrado
// ---------------------------------------------------------------------------

type MessageRow = { id: string; prospect_id: string; campaign_id: string | null; demo_id: string | null; channel: Channel; step: number; recipient: string; subject: string | null; body: string; evidence: string; review: string | null; status: string; sent_at: string | null };

async function getMessage(db: D1Binding, id: string) {
  const message = await db.prepare("SELECT * FROM prospect_messages WHERE id = ?").bind(id).first<MessageRow>();
  if (!message) throw new ProspectError("Mensaje no encontrado.", 404, "not_found");
  return message;
}

function defaultRecipient(prospect: ProspectRow, channel: Channel) {
  if (channel === "email") return prospect.email_public;
  if (channel === "whatsapp" || channel === "phone") return prospect.phone_public;
  if (channel === "instagram_dm") return prospect.instagram_url;
  return prospect.address ?? prospect.name;
}

async function runReview(ctx: ProspectContext, message: Pick<MessageRow, "id" | "prospect_id" | "campaign_id" | "demo_id" | "channel" | "recipient" | "subject" | "body" | "evidence">): Promise<ReviewResult> {
  const prospect = await getProspect(ctx.db, message.prospect_id);
  const demo = message.demo_id ? await ctx.db.prepare("SELECT status, access_expires_at FROM prospect_demos WHERE id = ?").bind(message.demo_id).first<{ status: string; access_expires_at: string | null }>() : null;
  const weekAgo = new Date(now(ctx).getTime() - 7 * 86_400_000).toISOString();
  const recent = await ctx.db.prepare("SELECT COUNT(*) AS n FROM prospect_messages WHERE prospect_id = ? AND status = 'sent' AND sent_at >= ? AND id != ?").bind(message.prospect_id, weekAgo, message.id).first<{ n: number }>();
  let capReached = false;
  if (message.campaign_id) {
    const campaign = await ctx.db.prepare("SELECT daily_contact_cap FROM prospect_campaigns WHERE id = ?").bind(message.campaign_id).first<{ daily_contact_cap: number }>();
    const dayStart = new Date(now(ctx).getTime() - 86_400_000).toISOString();
    const sentToday = await ctx.db.prepare("SELECT COUNT(*) AS n FROM prospect_messages WHERE campaign_id = ? AND status = 'sent' AND sent_at >= ?").bind(message.campaign_id, dayStart).first<{ n: number }>();
    capReached = Boolean(campaign && (sentToday?.n ?? 0) >= campaign.daily_contact_cap);
  }
  return reviewMessage({
    prospect,
    message: { channel: message.channel, recipient: message.recipient, subject: message.subject, body: message.body, evidence: parseJson(message.evidence, []) },
    demo: demo ? { status: demo.status, expiresAt: demo.access_expires_at } : null,
    suppressed: await findSuppressions(ctx.db, suppressionKeys(prospect, message.recipient)),
    recentSentCount: recent?.n ?? 0,
    campaignCapReached: capReached,
    now: now(ctx),
  });
}

/** Agente de redacción comercial: borrador idempotente por prospecto/campaña/canal/paso. */
export async function draftMessage(ctx: ProspectContext, id: string, input: z.infer<typeof draftSchema>) {
  requireRole(ctx.actor, "operator");
  const config = await requireAgent(ctx, "outreach_writer");
  const prospect = await getProspect(ctx.db, id);
  const step = input.step ?? 1;
  const allowed: ProspectStatus[] = step === 1 ? ["approved"] : ["contacted", "replied"];
  if (!allowed.includes(prospect.status)) throw new ProspectError(step === 1 ? "Solo un prospecto aprobado por una persona permite preparar el primer mensaje." : "El seguimiento requiere un primer contacto registrado.", 409, "not_approved");
  const recipient = input.recipient || defaultRecipient(prospect, input.channel);
  if (!recipient) throw new ProspectError("No hay un canal de contacto público para este medio.", 409, "no_recipient");
  const demo = await ctx.db.prepare("SELECT id FROM prospect_demos WHERE prospect_id = ? AND status = 'approved' ORDER BY version DESC LIMIT 1").bind(id).first<{ id: string }>();
  const draft = draftOutreach({ channel: input.channel, step, prospect, senderName: config.settings.senderName ?? "Equipo Punto Digital" });
  const campaignId = input.campaignId ?? prospect.campaign_id ?? null;
  const key = `${id}:${campaignId ?? "sin-campana"}:${input.channel}:${step}`;
  const messageId = uid("msg");
  const actor = agentActor(ctx, "outreach_writer");
  const review = await runReview(ctx, { id: messageId, prospect_id: id, campaign_id: campaignId, demo_id: demo?.id ?? null, channel: input.channel, recipient, subject: draft.subject, body: draft.body, evidence: json(draft.evidence) });
  const at = iso(ctx);
  const changed = await atomic(ctx,
    ctx.db.prepare("INSERT OR IGNORE INTO prospect_messages (id, prospect_id, campaign_id, demo_id, channel, step, recipient, subject, body, evidence, review, status, idempotency_key, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)")
      .bind(messageId, id, campaignId, demo?.id ?? null, input.channel, step, recipient, draft.subject, draft.body, json(draft.evidence), json(review), key, actorId(actor), at, at),
    auditStatement(ctx, actor, "message.drafted", "message", messageId, { prospectId: id, channel: input.channel, step, reviewPassed: review.passed }, true));
  if (changed !== 1) {
    const existing = await ctx.db.prepare("SELECT id FROM prospect_messages WHERE idempotency_key = ?").bind(key).first<{ id: string }>();
    return { id: existing!.id, created: false };
  }
  return { id: messageId, created: true, review };
}

export async function updateMessage(ctx: ProspectContext, messageId: string, patch: z.infer<typeof messagePatchSchema>) {
  requireRole(ctx.actor, "operator");
  const message = await getMessage(ctx.db, messageId);
  if (message.status !== "draft") throw new ProspectError("Solo se pueden editar borradores.", 409, "not_draft");
  const next = { ...message, subject: patch.subject !== undefined ? patch.subject : message.subject, body: patch.body ?? message.body, recipient: patch.recipient ?? message.recipient };
  const review = await runReview(ctx, next);
  const changed = await atomic(ctx, ctx.db.prepare("UPDATE prospect_messages SET subject = ?, body = ?, recipient = ?, review = ?, updated_at = ? WHERE id = ? AND status = 'draft'").bind(next.subject, next.body, next.recipient, json(review), iso(ctx), messageId), auditStatement(ctx, ctx.actor, "message.edited", "message", messageId, { reviewPassed: review.passed }, true));
  if (changed !== 1) throw new ProspectError("El mensaje cambió de estado.", 409, "stale");
  return { review };
}

export async function approveMessage(ctx: ProspectContext, messageId: string) {
  requireRole(ctx.actor, "reviewer");
  const message = await getMessage(ctx.db, messageId);
  if (message.status !== "draft") throw new ProspectError("Solo se aprueban borradores.", 409, "not_draft");
  const review = await runReview(ctx, message);
  if (!review.passed) {
    await ctx.db.prepare("UPDATE prospect_messages SET review = ?, updated_at = ? WHERE id = ?").bind(json(review), iso(ctx), messageId).run();
    throw new ProspectError("La revisión de cumplimiento tiene controles pendientes.", 409, "review_failed");
  }
  const at = iso(ctx);
  const changed = await atomic(ctx, ctx.db.prepare("UPDATE prospect_messages SET status = 'approved', review = ?, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ? AND status = 'draft'").bind(json(review), ctx.actor.email, at, at, messageId), auditStatement(ctx, ctx.actor, "message.approved", "message", messageId, { prospectId: message.prospect_id }, true));
  if (changed !== 1) throw new ProspectError("El mensaje ya fue procesado.", 409, "stale");
  return { approved: true };
}

/**
 * Prepara el texto final para envío manual: emite un enlace de demo nuevo y lo inserta.
 * No envía nada; el sistema no tiene canal de envío automático.
 */
export async function prepareMessageForSending(ctx: ProspectContext, messageId: string) {
  requireRole(ctx.actor, "reviewer");
  const message = await getMessage(ctx.db, messageId);
  if (message.status !== "approved") throw new ProspectError("El mensaje debe estar aprobado.", 409, "not_approved");
  const review = await runReview(ctx, message);
  if (!review.passed) throw new ProspectError("La revisión de cumplimiento ya no pasa (exclusión, demo o frecuencia).", 409, "review_failed");
  let body = message.body;
  let link: { url: string; expiresAt: string } | null = null;
  if (message.demo_id && body.includes("{{enlace_propuesta}}")) {
    link = await issueDemoLink(ctx, message.demo_id);
    body = renderWithLink(body, link.url);
  }
  await audit(ctx, ctx.actor, "message.prepared", "message", messageId, { linkExpiresAt: link?.expiresAt ?? null });
  return { channel: message.channel, recipient: message.recipient, subject: message.subject, body, linkExpiresAt: link?.expiresAt ?? null };
}

/** Registro idempotente de un envío manual hecho por una persona. */
export async function markMessageSent(ctx: ProspectContext, messageId: string) {
  requireRole(ctx.actor, "reviewer");
  const message = await getMessage(ctx.db, messageId);
  if (message.status === "sent") throw new ProspectError("Este envío ya estaba registrado.", 409, "already_sent");
  if (message.status !== "approved") throw new ProspectError("El mensaje debe estar aprobado.", 409, "not_approved");
  const prospect = await getProspect(ctx.db, message.prospect_id);
  if ((await findSuppressions(ctx.db, suppressionKeys(prospect, message.recipient))).length) throw new ProspectError("El contacto solicitó no ser contactado.", 409, "suppressed");
  const at = iso(ctx);
  const changed = await atomic(ctx, ctx.db.prepare("UPDATE prospect_messages SET status = 'sent', sent_by = ?, sent_at = ?, updated_at = ? WHERE id = ? AND status = 'approved'").bind(ctx.actor.email, at, at, messageId), auditStatement(ctx, ctx.actor, "message.sent_manually", "message", messageId, { prospectId: prospect.id, channel: message.channel }, true));
  if (changed !== 1) throw new ProspectError("Este envío ya estaba registrado.", 409, "already_sent");
  if (prospect.status === "approved") await transition(ctx, prospect, "contacted", ctx.actor, `Primer contacto manual por ${message.channel}`);
  return { sent: true };
}

export async function discardMessage(ctx: ProspectContext, messageId: string) {
  requireRole(ctx.actor, "operator");
  const changed = await atomic(ctx, ctx.db.prepare("UPDATE prospect_messages SET status = 'discarded', updated_at = ? WHERE id = ? AND status IN ('draft', 'approved')").bind(iso(ctx), messageId), auditStatement(ctx, ctx.actor, "message.discarded", "message", messageId, {}, true));
  if (changed !== 1) throw new ProspectError("El mensaje no puede descartarse.", 409, "stale");
  return { discarded: true };
}

// ---------------------------------------------------------------------------
// Seguimiento, reuniones y conversiones
// ---------------------------------------------------------------------------

const ACTIVITY_TRANSITIONS: Partial<Record<string, ProspectStatus>> = { reply: "replied", meeting: "meeting", won: "won", lost: "lost" };

export async function logActivity(ctx: ProspectContext, id: string, input: z.infer<typeof activitySchema>) {
  const target = ACTIVITY_TRANSITIONS[input.type];
  requireRole(ctx.actor, target ? "reviewer" : "operator");
  const prospect = await getProspect(ctx.db, id);
  if (input.type === "won" && !input.dealValueMxn) throw new ProspectError("Registra el valor del contrato en MXN.", 422, "missing_value");
  const at = iso(ctx);
  const activityId = uid("act");
  const insert = ctx.db.prepare("INSERT INTO prospect_activities (id, prospect_id, type, occurred_at, scheduled_at, summary, deal_value_mxn, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(activityId, id, input.type, input.occurredAt ?? at, input.scheduledAt ?? null, input.summary, input.dealValueMxn ?? null, ctx.actor.email, at);
  if (target && target !== prospect.status && !(input.type === "meeting" && prospect.status === "meeting")) {
    await transition(ctx, prospect, target, ctx.actor, `Actividad: ${input.type}`, [insert]);
  } else {
    await ctx.db.batch([insert, auditStatement(ctx, ctx.actor, "activity.logged", "prospect", id, { type: input.type })]);
  }
  return { id: activityId, status: prospect.status };
}

// ---------------------------------------------------------------------------
// Exclusiones (opt-out): bloquean cualquier contacto futuro
// ---------------------------------------------------------------------------

function normalizeSuppressionValue(kind: SuppressionKind, value: string) {
  if (kind === "email") return normalizeEmail(value);
  if (kind === "phone") return normalizePhone(value);
  if (kind === "domain") return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || null;
  if (kind === "instagram") return value.trim().toLowerCase().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").split("/")[0] || null;
  return value.trim() || null;
}

async function applySuppressions(ctx: ProspectContext, reason: string) {
  const { results } = await ctx.db.prepare("SELECT * FROM prospect_prospects WHERE status != 'suppressed' AND deleted_at IS NULL").all<ProspectRow>();
  let affected = 0;
  for (const prospect of results) {
    if ((await findSuppressions(ctx.db, suppressionKeys(prospect))).length === 0) continue;
    await transition(ctx, prospect, "suppressed", ctx.actor, reason, [
      ctx.db.prepare("UPDATE prospect_messages SET status = 'discarded', updated_at = ? WHERE prospect_id = ? AND status IN ('draft', 'approved')").bind(iso(ctx), prospect.id),
      ctx.db.prepare("UPDATE prospect_demos SET access_token_hash = NULL, updated_at = ? WHERE prospect_id = ?").bind(iso(ctx), prospect.id),
    ]);
    affected += 1;
  }
  return affected;
}

export async function addSuppression(ctx: ProspectContext, input: z.infer<typeof suppressionSchema>) {
  requireRole(ctx.actor, "operator");
  const value = normalizeSuppressionValue(input.kind, input.value);
  if (!value) throw new ProspectError("Valor de exclusión inválido.", 422, "invalid_value");
  const id = uid("sup");
  await atomic(ctx, ctx.db.prepare("INSERT OR IGNORE INTO prospect_suppressions (id, kind, value, reason, source, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, input.kind, value, input.reason, input.source, ctx.actor.email, iso(ctx)), auditStatement(ctx, ctx.actor, "suppression.added", "suppression", id, { kind: input.kind, source: input.source }, true));
  return { affectedProspects: await applySuppressions(ctx, `Exclusión (${input.kind}): ${input.reason}`) };
}

/** Excluye un prospecto concreto y todos sus identificadores de contacto. */
export async function suppressProspect(ctx: ProspectContext, id: string, reason: string) {
  requireRole(ctx.actor, "operator");
  const prospect = await getProspect(ctx.db, id);
  const keys = suppressionKeys(prospect);
  if (keys.length === 0) keys.push({ kind: "place_id", value: `prospect:${prospect.id}` });
  const at = iso(ctx);
  await ctx.db.batch(keys.map((key) => ctx.db.prepare("INSERT OR IGNORE INTO prospect_suppressions (id, kind, value, reason, source, created_by, created_at) VALUES (?, ?, ?, ?, 'manual', ?, ?)").bind(uid("sup"), key.kind, key.value, reason, ctx.actor.email, at)));
  if (prospect.status !== "suppressed") {
    await transition(ctx, prospect, "suppressed", ctx.actor, reason, [
      ctx.db.prepare("UPDATE prospect_messages SET status = 'discarded', updated_at = ? WHERE prospect_id = ? AND status IN ('draft', 'approved')").bind(at, id),
      ctx.db.prepare("UPDATE prospect_demos SET access_token_hash = NULL, updated_at = ? WHERE prospect_id = ?").bind(at, id),
    ]);
  }
  return { suppressed: true, keys: keys.length, alsoAffected: await applySuppressions(ctx, reason) };
}

// ---------------------------------------------------------------------------
// Configuración (administración)
// ---------------------------------------------------------------------------

export async function saveAgentConfig(ctx: ProspectContext, input: z.infer<typeof agentConfigSchema>) {
  requireRole(ctx.actor, "admin");
  const at = iso(ctx);
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO prospect_agent_configs (agent, enabled, provider, model, prompt_version, settings, updated_by, updated_at) VALUES (?, ?, ?, ?, 'v1', ?, ?, ?) ON CONFLICT(agent) DO UPDATE SET enabled = excluded.enabled, provider = excluded.provider, model = excluded.model, settings = excluded.settings, updated_by = excluded.updated_by, updated_at = excluded.updated_at")
      .bind(input.agent, input.enabled ? 1 : 0, input.provider, input.model ?? null, json(input.settings), ctx.actor.email, at),
    auditStatement(ctx, ctx.actor, "settings.agent_updated", "agent", input.agent, { enabled: input.enabled, provider: input.provider, model: input.model ?? null, settings: input.settings }),
  ]);
  return { saved: true };
}

export async function saveBudget(ctx: ProspectContext, input: z.infer<typeof budgetSchema>) {
  requireRole(ctx.actor, "admin");
  const cents = Math.round(input.monthlyLimitUsd * 100);
  const at = iso(ctx);
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO prospect_provider_budgets (provider, monthly_limit_usd_cents, enabled, updated_by, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(provider) DO UPDATE SET monthly_limit_usd_cents = excluded.monthly_limit_usd_cents, enabled = excluded.enabled, updated_by = excluded.updated_by, updated_at = excluded.updated_at").bind(input.provider, cents, input.enabled ? 1 : 0, ctx.actor.email, at),
    auditStatement(ctx, ctx.actor, "settings.budget_updated", "budget", input.provider, { monthlyLimitUsdCents: cents, enabled: input.enabled }),
  ]);
  return { saved: true };
}

export async function saveTeamMember(ctx: ProspectContext, input: z.infer<typeof teamSchema>) {
  requireRole(ctx.actor, input.role === "admin" ? "owner" : "admin");
  if (input.email === ctx.actor.email) throw new ProspectError("No puedes cambiar tu propio rol.", 409, "self_change");
  const at = iso(ctx);
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO prospect_team (email, role, active, added_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET role = excluded.role, active = excluded.active, updated_at = excluded.updated_at").bind(input.email, input.role, input.active ? 1 : 0, ctx.actor.email, at, at),
    auditStatement(ctx, ctx.actor, "settings.team_updated", "team", input.email, { role: input.role, active: input.active }),
  ]);
  return { saved: true };
}

export async function saveCampaign(ctx: ProspectContext, input: z.infer<typeof campaignSchema>, id?: string) {
  requireRole(ctx.actor, "reviewer");
  const at = iso(ctx);
  const campaignId = id ?? uid("cmp");
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO prospect_campaigns (id, name, city, zone, category, status, daily_contact_cap, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, city = excluded.city, zone = excluded.zone, category = excluded.category, status = excluded.status, daily_contact_cap = excluded.daily_contact_cap, notes = excluded.notes, updated_at = excluded.updated_at")
      .bind(campaignId, input.name, input.city ?? null, input.zone ?? null, input.category ?? null, input.status, input.dailyContactCap, input.notes ?? null, ctx.actor.email, at, at),
    auditStatement(ctx, ctx.actor, id ? "campaign.updated" : "campaign.created", "campaign", campaignId, { status: input.status }),
  ]);
  return { id: campaignId };
}

/** Purga el contenido de Places vencido (se conserva el place_id, permitido por los términos). */
export async function purgeExpiredPlacesContent(ctx: ProspectContext) {
  requireRole(ctx.actor, "admin");
  const at = iso(ctx);
  const result = await ctx.db.prepare(`UPDATE prospect_prospects SET address = NULL, phone_public = CASE WHEN status IN ('contacted','replied','meeting','won') THEN phone_public ELSE NULL END,
      website = CASE WHEN EXISTS (SELECT 1 FROM prospect_evidence e WHERE e.prospect_id = prospect_prospects.id AND e.kind = 'website') THEN website ELSE NULL END,
      places_content_expires_at = NULL, updated_at = ? WHERE source = 'google_places' AND places_content_expires_at IS NOT NULL AND places_content_expires_at <= ?`).bind(at, at).run();
  const purged = result.meta?.changes ?? 0;
  await audit(ctx, ctx.actor, "maintenance.places_purged", "prospect", "*", { purged });
  return { purged };
}

export { prospectPatchSchema };
