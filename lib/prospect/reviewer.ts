import { emailDomain, instagramHandle, isPersonalEmailDomain, normalizeEmail, normalizePhone, registrableDomain } from "./normalize";
import { DEMO_LINK_PLACEHOLDER, OPT_OUT_LINE, type OutreachEvidence } from "./outreach";
import type { Channel, ProspectRow, SuppressionKind } from "./types";

/**
 * Agente supervisor de calidad y cumplimiento. No aprueba: produce una lista de verificación
 * que bloquea la aprobación humana si algún control crítico falla.
 */
export type ReviewCheck = { id: string; label: string; passed: boolean; detail: string; blocking: boolean };
export type ReviewResult = { passed: boolean; checks: ReviewCheck[]; reviewedAt: string };

export const BANNED_CLAIMS: Array<[RegExp, string]> = [
  [/\d+\s?%/, "Porcentajes no comprobados"],
  [/garantiz/i, "Garantías de resultado"],
  [/(aumenta|duplica|triplica|multiplica)\w*\s+(tus|sus)?\s*(ventas|clientes|seguidores)/i, "Promesas de crecimiento"],
  [/ahorr\w+\s+\d+/i, "Cifras de ahorro"],
  [/(última oportunidad|solo hoy|urgente|antes de que sea tarde|oferta expira)/i, "Falsa urgencia"],
  [/(su cuenta oficial|en nombre de|somos parte de)/i, "Suplantación o afiliación"],
];

export type ReviewInput = {
  prospect: Pick<ProspectRow, "status" | "name" | "website" | "email_public" | "phone_public" | "instagram_url" | "google_place_id">;
  message: { channel: Channel; recipient: string; subject: string | null; body: string; evidence: OutreachEvidence[] };
  demo: { status: string; expiresAt: string | null } | null;
  suppressed: Array<{ kind: SuppressionKind; value: string }>;
  recentSentCount: number;
  campaignCapReached: boolean;
  now: Date;
};

export function suppressionKeys(prospect: ReviewInput["prospect"], recipient?: string) {
  const keys: Array<{ kind: SuppressionKind; value: string }> = [];
  for (const email of [prospect.email_public, recipient]) {
    const normalized = normalizeEmail(email);
    if (normalized) {
      keys.push({ kind: "email", value: normalized });
      // Un dominio de correo personal nunca se usa como clave: excluiría a terceros.
      if (!isPersonalEmailDomain(normalized)) keys.push({ kind: "domain", value: emailDomain(normalized) });
    }
  }
  const domain = registrableDomain(prospect.website);
  if (domain) keys.push({ kind: "domain", value: domain });
  for (const phone of [prospect.phone_public, recipient]) {
    const normalized = normalizePhone(phone);
    if (normalized) keys.push({ kind: "phone", value: normalized });
  }
  const handle = instagramHandle(prospect.instagram_url) ?? instagramHandle(recipient);
  if (handle) keys.push({ kind: "instagram", value: handle });
  if (prospect.google_place_id) keys.push({ kind: "place_id", value: prospect.google_place_id });
  return keys.filter((key, index, all) => all.findIndex((other) => other.kind === key.kind && other.value === key.value) === index);
}

function recipientIsPublicBusinessChannel(input: ReviewInput) {
  const { channel, recipient } = input.message;
  const { prospect } = input;
  if (channel === "email") {
    const email = normalizeEmail(recipient);
    if (!email) return { ok: false, detail: "Correo inválido." };
    if (isPersonalEmailDomain(email)) return { ok: false, detail: "Correo de proveedor personal; requiere verificar que sea el canal comercial publicado." };
    const siteDomain = registrableDomain(prospect.website);
    const listed = normalizeEmail(prospect.email_public) === email;
    if (!listed && (!siteDomain || emailDomain(email) !== siteDomain)) return { ok: false, detail: "El correo no coincide con el correo público registrado ni con el dominio del sitio." };
    return { ok: true, detail: "Correo comercial publicado por el negocio." };
  }
  if (channel === "whatsapp" || channel === "phone") {
    const phone = normalizePhone(recipient);
    return phone && phone === normalizePhone(prospect.phone_public) ? { ok: true, detail: "Teléfono comercial público registrado." } : { ok: false, detail: "El teléfono no coincide con el teléfono comercial registrado." };
  }
  if (channel === "instagram_dm") {
    const handle = instagramHandle(recipient) ?? recipient.replace(/^@/, "").toLowerCase();
    return handle && handle === instagramHandle(prospect.instagram_url) ? { ok: true, detail: "Perfil público registrado; envío manual desde la cuenta de Punto Digital." } : { ok: false, detail: "El perfil no coincide con el Instagram registrado." };
  }
  return { ok: true, detail: "Contacto presencial." };
}

export function reviewMessage(input: ReviewInput): ReviewResult {
  const checks: ReviewCheck[] = [];
  const add = (id: string, label: string, passed: boolean, detail: string, blocking = true) => checks.push({ id, label, passed, detail, blocking });
  const text = `${input.message.subject ?? ""}\n${input.message.body}`;

  add("status", "Prospecto aprobado por una persona", input.prospect.status === "approved", `Estado actual: ${input.prospect.status}.`);
  const demoValid = input.demo?.status === "approved" && (!input.demo.expiresAt || new Date(input.demo.expiresAt) > input.now);
  const linksDemo = text.includes(DEMO_LINK_PLACEHOLDER);
  add("demo", "Demo aprobada y vigente", !linksDemo || demoValid, linksDemo ? (demoValid ? "La demo está aprobada." : "El mensaje enlaza una demo no aprobada o vencida.") : "El mensaje no enlaza demo.");
  add("suppression", "Sin solicitudes de exclusión", input.suppressed.length === 0, input.suppressed.length ? `Coincide con exclusión: ${input.suppressed.map((s) => s.kind).join(", ")}.` : "Sin coincidencias en la lista de supresión.");
  const channel = recipientIsPublicBusinessChannel(input);
  add("channel", "Canal comercial público", channel.ok, channel.detail);
  add("opt_out", "Incluye forma de darse de baja", input.message.channel === "in_person" || input.message.body.includes(OPT_OUT_LINE), "El mensaje debe ofrecer una forma clara de no recibir más contactos.");
  const banned = BANNED_CLAIMS.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
  add("claims", "Sin afirmaciones no comprobadas", banned.length === 0, banned.length ? `Detectado: ${banned.join(", ")}.` : "Sin cifras, garantías ni urgencias.");
  const unsupported = input.message.evidence.filter((item) => !item.source);
  add("evidence", "Personalización respaldada por evidencia", unsupported.length === 0, unsupported.length ? "Hay afirmaciones sin fuente." : `${input.message.evidence.length} afirmación(es) con fuente.`);
  add("name", "Nombre del negocio correcto", text.includes(input.prospect.name), "El mensaje debe mencionar el nombre registrado.", false);
  add("frequency", "Sin contacto reciente duplicado", input.recentSentCount === 0, input.recentSentCount ? `${input.recentSentCount} mensaje(s) enviado(s) en los últimos 7 días.` : "Sin envíos en los últimos 7 días.");
  add("cap", "Dentro del límite diario de la campaña", !input.campaignCapReached, input.campaignCapReached ? "La campaña alcanzó su límite diario." : "Dentro del límite.");
  return { passed: checks.every((check) => check.passed || !check.blocking), checks, reviewedAt: input.now.toISOString() };
}
