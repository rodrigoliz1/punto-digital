import { notFound } from "next/navigation";
import { requireStaffPage, staffFromRequest } from "@/lib/auth/next";
import { getD1Binding, getR2Binding } from "@/lib/runtime-bindings";
import type { ProspectContext } from "./service";
import { type Role, roleAtLeast } from "./types";

/**
 * Prospect OS exige sesión del equipo verificada en servidor (contraseña + TOTP, ver lib/auth).
 * Ningún encabezado de identidad enviado por el cliente se toma en cuenta.
 * Permanece apagado salvo PROSPECT_OS_ENABLED=true, y nunca opera en Vercel (sin D1).
 */
export function prospectOsEnabled() {
  return process.env.PRIVATE_SURFACES_ENABLED === "true" && process.env.PROSPECT_OS_ENABLED === "true" && !process.env.VERCEL;
}

export function prospectEnv(): ProspectContext["env"] {
  return {
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://www.ipunto.digital",
  };
}

/** Para páginas del panel: sin sesión redirige al acceso; sin rol suficiente responde 404. */
export async function requireProspectPage(returnTo: string, minimum: Role = "viewer"): Promise<ProspectContext> {
  if (!prospectOsEnabled()) notFound();
  const db = getD1Binding();
  if (!db) notFound();
  const identity = await requireStaffPage(returnTo, minimum);
  return { db, r2: getR2Binding() ?? null, actor: { kind: "human", email: identity.email, role: identity.role }, env: prospectEnv() };
}

/** Para la API: devuelve el contexto o una respuesta de error (401 sin sesión, 403 sin rol). */
export async function requireProspectApi(request: Request, minimum: Role = "viewer"): Promise<ProspectContext | Response> {
  const noStore = { "cache-control": "private, no-store" };
  if (!prospectOsEnabled()) return Response.json({ error: "No encontrado." }, { status: 404, headers: noStore });
  const db = getD1Binding();
  if (!db) return Response.json({ error: "La base de datos no está disponible en este entorno." }, { status: 503, headers: noStore });
  const identity = await staffFromRequest(request);
  if (!identity) return Response.json({ error: "Inicia sesión." }, { status: 401, headers: noStore });
  if (!roleAtLeast(identity.role, minimum)) return Response.json({ error: "No tienes permiso para esta acción." }, { status: 403, headers: noStore });
  return { db, r2: getR2Binding() ?? null, actor: { kind: "human", email: identity.email, role: identity.role }, env: prospectEnv() };
}
