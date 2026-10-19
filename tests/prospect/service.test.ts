import assert from "node:assert/strict";
import test from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import * as service from "@/lib/prospect/service";
import { ProspectError, type Role } from "@/lib/prospect/types";
import { createTestD1 } from "./d1-sqlite";

const SITE_HTML = `<html lang="es"><head><title>Café Aurora</title><meta name="description" content="Café en Providencia"><meta name="viewport" content="width=device-width"><style>.a{color:#3b2a20}.b{color:#c8a27a}</style></head><body><a href="https://www.instagram.com/cafeaurora/">ig</a><a href="mailto:hola@cafeaurora.mx">mail</a></body></html>`;

function setup(role: Role = "owner") {
  const db = createTestD1();
  let clock = new Date("2026-10-19T15:00:00Z");
  const fetchImpl: typeof fetch = async (url) => {
    if (String(url).startsWith("https://places.googleapis.com")) return Response.json({ places: [{ id: "place_1", displayName: { text: "Café Aurora" }, websiteUri: "https://cafeaurora.mx/", nationalPhoneNumber: "33 1234 5678", businessStatus: "OPERATIONAL", googleMapsUri: "https://maps.google.com/?cid=1" }] });
    return new Response(SITE_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
  };
  const make = (r: Role, email = `${r}@ipunto.digital`): service.ProspectContext => ({ db, actor: { kind: "human", email, role: r }, env: { SITE_URL: "https://www.ipunto.digital", GOOGLE_PLACES_API_KEY: "test" }, now: () => clock, fetchImpl, resolver: async () => ["93.184.216.34"] });
  return { db, ctx: make(role), as: make, tick: (ms: number) => { clock = new Date(clock.getTime() + ms); } };
}

const strongSignals = { budget_fit: 4, presence_gap: 4, posts_last_28d: 3, product_quality: 4, contact_quality: 4, service_fit: 5 };

async function auditActions(db: ReturnType<typeof createTestD1>, entityId: string) {
  return (await db.prepare("SELECT action, payload FROM audit_logs WHERE entity_id = ? ORDER BY created_at, rowid").bind(entityId).all<{ action: string; payload: string }>()).results;
}

test("flujo completo: descubrir → calificar → demo → aprobar → mensaje → envío manual", async () => {
  const { db, ctx, as } = setup();
  await service.saveBudget(ctx, { provider: "google_places", monthlyLimitUsd: 10, enabled: true });
  const found = await service.discover(ctx, { category: "cafetería", city: "Guadalajara", zone: "Providencia" }, "req-1");
  assert.equal(found.created, 1);
  const again = await service.discover(ctx, { category: "cafetería", city: "Guadalajara", zone: "Providencia" }, "req-1");
  assert.deepEqual(again, found, "misma clave de solicitud: resultado idempotente");
  const usage = await db.prepare("SELECT COUNT(*) AS n FROM prospect_api_usage").first<{ n: number }>();
  assert.equal(usage?.n, 1, "no se cobra dos veces");
  const id = found.ids[0];

  const analysis = await service.analyzeProspectWebsite(ctx, id, "a1");
  assert.equal(analysis.analyzed, true);
  let prospect = await service.getProspect(db, id);
  assert.equal(prospect.email_public, "hola@cafeaurora.mx");
  assert.equal(prospect.instagram_url, "https://www.instagram.com/cafeaurora");

  await service.updateProspect(ctx, id, { signals: strongSignals });
  const scored = await service.qualify(ctx, id);
  assert.equal(scored.status, "qualified");

  await assert.rejects(service.approveProspect(ctx, id), ProspectError);
  await service.generateBrief(ctx, id, {}, "b1");
  const demo = await service.buildDemo(ctx, id);
  prospect = await service.getProspect(db, id);
  assert.equal(prospect.status, "demo_ready");

  await assert.rejects(service.approveProspect(as("operator"), id), (error: ProspectError) => error.code === "forbidden");
  await service.approveProspect(as("reviewer"), id);
  prospect = await service.getProspect(db, id);
  assert.equal(prospect.status, "approved");

  const link = await service.issueDemoLink(as("reviewer"), demo.demoId);
  const token = link.url.split("/propuesta/")[1].replace(/\/$/, "");
  assert.ok(await service.resolveDemoByToken(db, token, new Date("2026-10-20T00:00:00Z")));
  assert.equal(await service.resolveDemoByToken(db, token, new Date("2026-12-31T00:00:00Z")), null, "el enlace expira");
  const stored = await db.prepare("SELECT access_token_hash FROM prospect_demos WHERE id = ?").bind(demo.demoId).first<{ access_token_hash: string }>();
  assert.notEqual(stored?.access_token_hash, token, "solo se guarda el hash");

  const draft = await service.draftMessage(ctx, id, { channel: "email" });
  assert.equal(draft.created, true);
  assert.equal(draft.review?.passed, true);
  const duplicate = await service.draftMessage(ctx, id, { channel: "email" });
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.id, draft.id);

  await assert.rejects(service.markMessageSent(as("reviewer"), draft.id), (error: ProspectError) => error.code === "not_approved");
  await service.approveMessage(as("reviewer"), draft.id);
  const prepared = await service.prepareMessageForSending(as("reviewer"), draft.id);
  assert.ok(prepared.body.includes("https://www.ipunto.digital/propuesta/"));
  assert.ok(!prepared.body.includes("{{enlace_propuesta}}"));
  assert.equal(await service.resolveDemoByToken(db, token, new Date("2026-10-20T00:00:00Z")), null, "preparar rota el enlace anterior");

  await service.markMessageSent(as("reviewer"), draft.id);
  await assert.rejects(service.markMessageSent(as("reviewer"), draft.id), (error: ProspectError) => error.code === "already_sent");
  prospect = await service.getProspect(db, id);
  assert.equal(prospect.status, "contacted");

  await service.logActivity(as("reviewer"), id, { type: "reply", summary: "Pidió más información" });
  await service.logActivity(as("reviewer"), id, { type: "meeting", summary: "Llamada", scheduledAt: "2026-10-22T17:00:00Z" });
  await assert.rejects(service.logActivity(as("reviewer"), id, { type: "won", summary: "Firmó" }), (error: ProspectError) => error.code === "missing_value");
  await service.logActivity(as("reviewer"), id, { type: "won", summary: "Firmó paquete profesional", dealValueMxn: 14900 });
  assert.equal((await service.getProspect(db, id)).status, "won");

  const actions = (await auditActions(db, id)).map((row) => row.action);
  for (const action of ["prospect.created", "prospect.analyzed", "prospect.updated", "prospect.scored", "brand.brief_created", "demo.created", "prospect.transition"]) assert.ok(actions.includes(action), action);
  const transitions = (await auditActions(db, id)).filter((row) => row.action === "prospect.transition").map((row) => JSON.parse(row.payload));
  assert.deepEqual(transitions.map((t) => t.to), ["qualified", "demo_ready", "approved", "contacted", "replied", "meeting", "won"]);
  assert.match(transitions.find((t) => t.to === "approved").actor, /^reviewer@/);
  assert.match(transitions.find((t) => t.to === "qualified").actor, /^agent:qualifier/);
});

test("exclusión: bloquea contacto, descarta borradores y desactiva enlaces", async () => {
  const { db, ctx } = setup();
  const created = await service.createProspect(ctx, { name: "Spa Lumen", category: "spa", city: "Zapopan", sourceUrl: "https://directorio.example.org/spa-lumen", website: "https://spalumen.mx", emailPublic: "citas@spalumen.mx", signals: strongSignals });
  await service.qualify(ctx, created.id);
  await service.generateBrief(ctx, created.id, {}, "b");
  const demo = await service.buildDemo(ctx, created.id);
  await service.approveProspect(ctx, created.id);
  const link = await service.issueDemoLink(ctx, demo.demoId);
  const draft = await service.draftMessage(ctx, created.id, { channel: "email" });

  const result = await service.addSuppression(ctx, { kind: "email", value: "CITAS@spalumen.mx", reason: "Respondió que no desea contacto", source: "opt_out_reply" });
  assert.equal(result.affectedProspects, 1);
  assert.equal((await service.getProspect(db, created.id)).status, "suppressed");
  const message = await db.prepare("SELECT status FROM prospect_messages WHERE id = ?").bind(draft.id).first<{ status: string }>();
  assert.equal(message?.status, "discarded");
  assert.equal(await service.resolveDemoByToken(db, link.url.split("/propuesta/")[1].replace(/\/$/, ""), new Date("2026-10-20T00:00:00Z")), null);

  const reimport = await service.importProspects(ctx, [{ name: "Spa Lumen 2", category: "spa", city: "Zapopan", sourceUrl: "https://directorio.example.org/x", emailPublic: "citas@spalumen.mx" }]);
  assert.equal(reimport.suppressed, 1, "una exclusión impide volver a importar el contacto");
  await assert.rejects(service.draftMessage(ctx, created.id, { channel: "email", step: 2 }), ProspectError);
});

test("presupuesto y permisos: sin presupuesto no hay llamadas con costo; los roles se respetan", async () => {
  const { ctx, as } = setup();
  await assert.rejects(service.discover(ctx, { category: "barbería", city: "Zapopan" }, "x"), (error: ProspectError) => error.code === "budget_disabled");
  await assert.rejects(service.createProspect(as("viewer"), { name: "X Y", category: "spa", city: "Zapopan", sourceUrl: "https://example.org" }), (error: ProspectError) => error.code === "forbidden");
  await assert.rejects(service.saveBudget(as("reviewer"), { provider: "anthropic", monthlyLimitUsd: 5, enabled: true }), (error: ProspectError) => error.code === "forbidden");
  await assert.rejects(service.saveTeamMember(as("admin"), { email: "otra@ipunto.digital", role: "admin", active: true }), (error: ProspectError) => error.code === "forbidden");
  await service.saveTeamMember(as("admin"), { email: "otra@ipunto.digital", role: "reviewer", active: true });
});

test("brief con Claude: registra costo y respeta el presupuesto", async () => {
  const { db, ctx } = setup();
  ctx.env.ANTHROPIC_API_KEY = "test";
  const created = await service.createProspect(ctx, { name: "Pilates Alma", category: "estudio de pilates", city: "Guadalajara", sourceUrl: "https://example.org/alma" });
  await assert.rejects(service.generateBrief(ctx, created.id, { useLlm: true }, "l0"), (error: ProspectError) => error.code === "budget_disabled");
  await service.saveBudget(ctx, { provider: "anthropic", monthlyLimitUsd: 5, enabled: true });
  const brief = { positioning: "p", audience: "a", voice: "v", palette: ["#28536b", "#c2948a", "#f2efe9"], visualDirection: "d", contentPillars: ["Clases"], assetPrompts: ["Estudio luminoso"], claimsToVerify: ["Horarios"], risks: [] };
  let request: Record<string, unknown> | undefined;
  ctx.anthropic = { beta: { messages: { create: async (params: Record<string, unknown>) => { request = params; return { model: "claude-opus-5-5", stop_reason: "end_turn", usage: { input_tokens: 2000, output_tokens: 1000 }, content: [{ type: "text", text: JSON.stringify(brief) }] }; } } } } as unknown as Anthropic;
  const result = await service.generateBrief(ctx, created.id, { useLlm: true }, "l1");
  assert.equal(result.generator, "anthropic:claude-opus-5-5");
  assert.equal(request?.model, "claude-opus-5-5");
  assert.equal(request?.fallbacks, "default");
  assert.ok(String(JSON.stringify(request?.messages)).includes("datos_no_confiables"));
  const spend = await db.prepare("SELECT SUM(cost_usd_micros) AS total FROM prospect_api_usage WHERE provider = 'anthropic'").first<{ total: number }>();
  assert.equal(spend?.total, 28_000);
});

test("concurrencia: una transición obsoleta no deja efectos parciales", async () => {
  const { db, ctx } = setup();
  const created = await service.createProspect(ctx, { name: "Taquería Sol", category: "restaurante", city: "Guadalajara", sourceUrl: "https://example.org/sol", phonePublic: "3311112222", signals: strongSignals });
  await service.qualify(ctx, created.id);
  await service.generateBrief(ctx, created.id, {}, "b");
  await service.buildDemo(ctx, created.id);
  // Otra persona cambia el estado entre la lectura (validación) y la escritura (lote).
  const originalBatch = db.batch.bind(db);
  db.batch = async (statements) => {
    db.batch = originalBatch;
    db.raw.prepare("UPDATE prospect_prospects SET status = 'lost' WHERE id = ?").run(created.id);
    return originalBatch(statements);
  };
  await assert.rejects(service.approveProspect(ctx, created.id), (error: ProspectError) => error.code === "stale");
  assert.equal((await service.getProspect(db, created.id)).status, "lost");
  const approvals = await db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_id = ? AND payload LIKE '%\"to\":\"approved\"%'").bind(created.id).first<{ n: number }>();
  assert.equal(approvals?.n, 0, "sin auditoría de una aprobación que no ocurrió");
  const demo = await db.prepare("SELECT status FROM prospect_demos WHERE prospect_id = ?").bind(created.id).first<{ status: string }>();
  assert.equal(demo?.status, "draft", "la demo no quedó aprobada a medias");
});
