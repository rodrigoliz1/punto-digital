import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getD1Binding } from "@/lib/runtime-bindings";
import { authenticate, type AuthEnv, DEV_SESSION_COOKIE, isLocalHost, readSessionToken, roleRank, SESSION_COOKIE, type StaffIdentity, type StaffRole } from "./staff";

export function authEnv(): AuthEnv {
  return { AUTH_SECRET: process.env.AUTH_SECRET, AUTH_SETUP_TOKEN: process.env.AUTH_SETUP_TOKEN, ADMIN_EMAIL: process.env.ADMIN_EMAIL };
}

export function privateSurfacesEnabled() {
  return process.env.PRIVATE_SURFACES_ENABLED === "true";
}

export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/admin") || value.startsWith("//") || value.includes("\\")) return "/admin";
  return value;
}

/** Identidad para rutas API: solo la cookie de sesión, nunca encabezados de identidad. */
export async function staffFromRequest(request: Request): Promise<StaffIdentity | null> {
  const db = getD1Binding();
  if (!privateSurfacesEnabled() || !db) return null;
  return authenticate(db, authEnv(), readSessionToken(request.headers.get("cookie"), request.url), new Date());
}

/** Identidad para páginas (server components). */
export async function staffForPage(): Promise<StaffIdentity | null> {
  const db = getD1Binding();
  if (!privateSurfacesEnabled() || !db) return null;
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const host = (headerStore.get("host") ?? "").replace(/:\d+$/, "");
  const token = cookieStore.get(SESSION_COOKIE)?.value ?? (isLocalHost(host) ? cookieStore.get(DEV_SESSION_COOKIE)?.value : undefined);
  return authenticate(db, authEnv(), token, new Date());
}

/** Exige sesión válida y rol mínimo; sin sesión redirige al acceso, sin rol responde 404. */
export async function requireStaffPage(returnTo: string, minimum: StaffRole): Promise<StaffIdentity> {
  if (!privateSurfacesEnabled()) notFound();
  const identity = await staffForPage();
  if (!identity) redirect(`/admin/acceso?next=${encodeURIComponent(safeNextPath(returnTo))}`);
  if (roleRank(identity.role) < roleRank(minimum)) notFound();
  return identity;
}
