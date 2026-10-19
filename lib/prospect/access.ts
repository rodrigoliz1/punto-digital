import { notFound, redirect } from "next/navigation";
import { chatGPTSignInPath, getChatGPTUser } from "@/app/chatgpt-auth";
import { getD1Binding, getR2Binding, type D1Binding } from "@/lib/runtime-bindings";
import type { ProspectContext } from "./service";
import { type Role, ROLES, roleAtLeast } from "./types";

/**
 * Prospect OS solo opera en Cloudflare (Sites), donde la plataforma inyecta y valida la identidad.
 * En Vercel los encabezados de identidad no son confiables, por lo que queda deshabilitado.
 */
export function prospectOsEnabled() {
  return process.env.PRIVATE_SURFACES_ENABLED === "true" && process.env.PROSPECT_OS_ENABLED === "true" && !process.env.VERCEL;
}

function ownerEmails() {
  return (process.env.ADMIN_EMAIL ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export async function resolveRole(db: D1Binding, email: string): Promise<Role | null> {
  const normalized = email.trim().toLowerCase();
  if (ownerEmails().includes(normalized)) return "owner";
  const member = await db.prepare("SELECT role FROM prospect_team WHERE email = ? AND active = 1").bind(normalized).first<{ role: string }>();
  return member && (ROLES as readonly string[]).includes(member.role) && member.role !== "owner" ? (member.role as Role) : null;
}

export function prospectEnv(): ProspectContext["env"] {
  return {
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://www.ipunto.digital",
  };
}

/** Para páginas del panel: responde 404 si no hay acceso (no revela la existencia del módulo). */
export async function requireProspectPage(returnTo: string, minimum: Role = "viewer"): Promise<ProspectContext> {
  if (!prospectOsEnabled()) notFound();
  const user = await getChatGPTUser();
  if (!user) redirect(chatGPTSignInPath(returnTo));
  const db = getD1Binding();
  if (!db) notFound();
  const role = await resolveRole(db, user.email);
  if (!role || !roleAtLeast(role, minimum)) notFound();
  return { db, r2: getR2Binding() ?? null, actor: { kind: "human", email: user.email.toLowerCase(), role }, env: prospectEnv() };
}

/** Para la API: devuelve el contexto o una respuesta de error. */
export async function requireProspectApi(minimum: Role = "viewer"): Promise<ProspectContext | Response> {
  if (!prospectOsEnabled()) return Response.json({ error: "No encontrado." }, { status: 404 });
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Inicia sesión." }, { status: 401 });
  const db = getD1Binding();
  if (!db) return Response.json({ error: "La base de datos no está disponible en este entorno." }, { status: 503 });
  const role = await resolveRole(db, user.email);
  if (!role) return Response.json({ error: "No encontrado." }, { status: 404 });
  if (!roleAtLeast(role, minimum)) return Response.json({ error: "No tienes permiso para esta acción." }, { status: 403 });
  return { db, r2: getR2Binding() ?? null, actor: { kind: "human", email: user.email.toLowerCase(), role }, env: prospectEnv() };
}
