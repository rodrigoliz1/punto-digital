import type { D1Binding } from "@/lib/runtime-bindings";
import { decryptSecret, dummyPasswordHash, encryptSecret, hashPassword, passwordProblems, randomToken, sha256Hex, timingSafeEqual, verifyPassword } from "./crypto";
import { generateTotpSecret, otpauthUri, verifyTotp } from "./totp";

/**
 * Autenticación del equipo de Punto Digital.
 * La identidad nunca proviene de encabezados enviados por el cliente: se verifica una cookie
 * de sesión aleatoria contra su hash en D1, emitida solo tras contraseña + TOTP.
 */

export const STAFF_ROLES = ["viewer", "operator", "reviewer", "admin", "owner"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export type AuthEnv = { AUTH_SECRET?: string; AUTH_SETUP_TOKEN?: string; ADMIN_EMAIL?: string };
export type StaffIdentity = { email: string; role: StaffRole; sessionId: string };

export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;
const SESSION_TOUCH_MS = 5 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const CREDENTIAL_TOKEN_MS = 72 * 60 * 60 * 1000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export class AuthError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "auth_error") {
    super(message);
  }
}

export function authConfigured(env: AuthEnv) {
  return typeof env.AUTH_SECRET === "string" && env.AUTH_SECRET.length >= 32;
}

function requireSecret(env: AuthEnv) {
  if (!authConfigured(env)) throw new AuthError("La autenticación no está configurada (AUTH_SECRET).", 503, "auth_not_configured");
  return env.AUTH_SECRET!;
}

export function normalizeStaffEmail(email: string) {
  return email.trim().toLowerCase();
}

function ownerEmails(env: AuthEnv) {
  return (env.ADMIN_EMAIL ?? "").split(",").map(normalizeStaffEmail).filter(Boolean);
}

/** Rol vigente: se resuelve en cada solicitud, así una baja surte efecto de inmediato. */
export async function resolveStaffRole(db: D1Binding, env: AuthEnv, email: string): Promise<StaffRole | null> {
  const normalized = normalizeStaffEmail(email);
  if (ownerEmails(env).includes(normalized)) return "owner";
  const member = await db.prepare("SELECT role FROM prospect_team WHERE email = ? AND active = 1").bind(normalized).first<{ role: string }>();
  if (!member || member.role === "owner" || !(STAFF_ROLES as readonly string[]).includes(member.role)) return null;
  return member.role as StaffRole;
}

export function roleRank(role: StaffRole) {
  return STAFF_ROLES.indexOf(role);
}

async function auditStaff(db: D1Binding, action: string, email: string, actor: string, payload: Record<string, unknown> = {}, at: Date) {
  await db.prepare("INSERT INTO audit_logs (id, profile_id, action, entity_type, entity_id, payload, created_at) VALUES (?, NULL, ?, 'staff', ?, ?, ?)")
    .bind(`aud_${crypto.randomUUID().replace(/-/g, "")}`, action, email, JSON.stringify({ actor, ...payload }), at.toISOString()).run();
}

// ---------------------------------------------------------------------------
// Inscripción: token de configuración inicial (solo sin cuentas) o invitación de un solo uso
// ---------------------------------------------------------------------------

type TokenCheck = { kind: "setup" } | { kind: "invite"; id: string };

async function checkEnrollmentToken(db: D1Binding, env: AuthEnv, email: string, token: string, at: Date): Promise<TokenCheck> {
  const invalid = new AuthError("El enlace o token de activación no es válido o ya venció.", 400, "invalid_token");
  if (TOKEN_PATTERN.test(token)) {
    const id = await sha256Hex(token);
    const row = await db.prepare("SELECT id, email, expires_at, used_at FROM staff_credential_tokens WHERE id = ?").bind(id).first<{ id: string; email: string; expires_at: string; used_at: string | null }>();
    if (row) {
      if (row.used_at || row.email !== email || new Date(row.expires_at) <= at) throw invalid;
      if (!(await resolveStaffRole(db, env, email))) throw invalid;
      return { kind: "invite", id };
    }
  }
  const setup = env.AUTH_SETUP_TOKEN ?? "";
  if (setup.length < 32 || !timingSafeEqual(token, setup) || !ownerEmails(env).includes(email)) throw invalid;
  const existing = await db.prepare("SELECT COUNT(*) AS n FROM staff_accounts").first<{ n: number }>();
  if ((existing?.n ?? 0) > 0) throw new AuthError("La configuración inicial ya se completó. Pide una invitación a un propietario.", 409, "setup_used");
  return { kind: "setup" };
}

export async function startEnrollment(db: D1Binding, env: AuthEnv, input: { email: string; token: string }, at: Date) {
  requireSecret(env);
  const email = normalizeStaffEmail(input.email);
  await checkEnrollmentToken(db, env, email, input.token, at);
  const secret = generateTotpSecret();
  return { secret, otpauthUri: otpauthUri(secret, email) };
}

export async function finishEnrollment(db: D1Binding, env: AuthEnv, input: { email: string; token: string; password: string; secret: string; code: string }, at: Date, meta: SessionMeta = {}) {
  const authSecret = requireSecret(env);
  const email = normalizeStaffEmail(input.email);
  const check = await checkEnrollmentToken(db, env, email, input.token, at);
  const problems = passwordProblems(input.password, email);
  if (problems.length) throw new AuthError(problems.join(" "), 422, "weak_password");
  if (!/^[A-Z2-7]{32}$/.test(input.secret)) throw new AuthError("Secreto de autenticador inválido.", 422, "invalid_secret");
  const counter = await verifyTotp(input.secret, input.code, at);
  if (counter === null) throw new AuthError("El código del autenticador no es correcto. Revisa la hora de tu teléfono.", 422, "invalid_code");
  const iso = at.toISOString();
  const statements = [
    db.prepare(`INSERT INTO staff_accounts (email, password_hash, totp_secret_enc, totp_last_counter, password_changed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, totp_secret_enc = excluded.totp_secret_enc, totp_last_counter = excluded.totp_last_counter, password_changed_at = excluded.password_changed_at, updated_at = excluded.updated_at`)
      .bind(email, await hashPassword(input.password), await encryptSecret(input.secret, authSecret), counter, iso, iso, iso),
    db.prepare("UPDATE staff_sessions SET revoked_at = ? WHERE email = ? AND revoked_at IS NULL").bind(iso, email),
    db.prepare("DELETE FROM staff_login_attempts WHERE key = ?").bind(`email:${email}`),
  ];
  if (check.kind === "invite") {
    // El token se consume en la misma transacción; si ya se usó, la guarda revierte todo.
    statements.unshift(db.prepare("UPDATE staff_credential_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL").bind(iso, check.id), db.prepare("SELECT CASE WHEN changes() = 0 THEN json('token_already_used') ELSE 1 END"));
  }
  try {
    await db.batch(statements);
  } catch (error) {
    if (/malformed JSON/i.test(String(error))) throw new AuthError("Este enlace de activación ya se utilizó.", 409, "token_used");
    throw error;
  }
  await auditStaff(db, check.kind === "setup" ? "staff.setup_completed" : "staff.enrolled", email, email, {}, at);
  return createSession(db, env, email, at, meta);
}

/** Invitación o restablecimiento emitido por un administrador. El token se muestra una sola vez. */
export async function issueCredentialToken(db: D1Binding, env: AuthEnv, actor: { email: string; role: StaffRole }, targetEmail: string, at: Date) {
  requireSecret(env);
  const email = normalizeStaffEmail(targetEmail);
  if (roleRank(actor.role) < roleRank("admin")) throw new AuthError("No tienes permiso para esta acción.", 403, "forbidden");
  if (email === actor.email) throw new AuthError("No puedes restablecer tu propio acceso desde aquí.", 409, "self_change");
  const targetRole = await resolveStaffRole(db, env, email);
  if (!targetRole) throw new AuthError("Primero agrega a la persona al equipo con un rol.", 409, "no_role");
  if (roleRank(targetRole) >= roleRank("admin") && actor.role !== "owner") throw new AuthError("Solo un propietario puede invitar o restablecer administradores.", 403, "forbidden");
  const account = await db.prepare("SELECT email FROM staff_accounts WHERE email = ?").bind(email).first();
  const token = randomToken();
  const expiresAt = new Date(at.getTime() + CREDENTIAL_TOKEN_MS).toISOString();
  await db.batch([
    db.prepare("UPDATE staff_credential_tokens SET used_at = ? WHERE email = ? AND used_at IS NULL").bind(at.toISOString(), email),
    db.prepare("INSERT INTO staff_credential_tokens (id, email, purpose, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)").bind(await sha256Hex(token), email, account ? "reset" : "invite", actor.email, at.toISOString(), expiresAt),
  ]);
  await auditStaff(db, account ? "staff.reset_issued" : "staff.invite_issued", email, actor.email, { expiresAt }, at);
  return { token, expiresAt, purpose: account ? "reset" : "invite" };
}

// ---------------------------------------------------------------------------
// Inicio de sesión con bloqueo progresivo por correo e IP
// ---------------------------------------------------------------------------

export type SessionMeta = { ip?: string | null; userAgent?: string | null };

async function attemptKeys(env: AuthEnv, email: string, ip: string | null | undefined) {
  const keys = [`email:${email}`];
  if (ip) keys.push(`ip:${await sha256Hex(`${env.AUTH_SECRET}:${ip}`)}`);
  return keys;
}

async function isLocked(db: D1Binding, keys: string[], at: Date) {
  for (const key of keys) {
    const row = await db.prepare("SELECT locked_until FROM staff_login_attempts WHERE key = ?").bind(key).first<{ locked_until: string | null }>();
    if (row?.locked_until && new Date(row.locked_until) > at) return true;
  }
  return false;
}

async function recordFailure(db: D1Binding, keys: string[], at: Date) {
  const iso = at.toISOString();
  const windowStart = new Date(at.getTime() - LOGIN_WINDOW_MS).toISOString();
  const lockUntil = new Date(at.getTime() + LOGIN_WINDOW_MS).toISOString();
  for (const key of keys) {
    await db.prepare(`INSERT INTO staff_login_attempts (key, window_start, failures) VALUES (?, ?, 1)
      ON CONFLICT(key) DO UPDATE SET failures = CASE WHEN window_start < ? THEN 1 ELSE failures + 1 END, window_start = CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END`).bind(key, iso, windowStart, windowStart).run();
    await db.prepare("UPDATE staff_login_attempts SET locked_until = ? WHERE key = ? AND failures >= ?").bind(lockUntil, key, LOGIN_MAX_FAILURES).run();
  }
}

const INVALID_LOGIN = new AuthError("Correo, contraseña o código incorrectos.", 401, "invalid_credentials");

export async function login(db: D1Binding, env: AuthEnv, input: { email: string; password: string; code: string }, at: Date, meta: SessionMeta = {}) {
  const authSecret = requireSecret(env);
  const email = normalizeStaffEmail(input.email);
  const keys = await attemptKeys(env, email, meta.ip);
  if (await isLocked(db, keys, at)) throw new AuthError("Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.", 429, "locked");
  const account = await db.prepare("SELECT password_hash, totp_secret_enc, totp_last_counter FROM staff_accounts WHERE email = ?").bind(email).first<{ password_hash: string; totp_secret_enc: string; totp_last_counter: number | null }>();
  const passwordOk = await verifyPassword(input.password, account?.password_hash ?? (await dummyPasswordHash()));
  const role = account ? await resolveStaffRole(db, env, email) : null;
  let counter: number | null = null;
  if (account && passwordOk && role) {
    try {
      counter = await verifyTotp(await decryptSecret(account.totp_secret_enc, authSecret), input.code, at, account.totp_last_counter);
    } catch {
      counter = null;
    }
  }
  if (!account || !passwordOk || !role || counter === null) {
    await recordFailure(db, keys, at);
    if (account) await auditStaff(db, "staff.login_failed", email, email, {}, at);
    throw INVALID_LOGIN;
  }
  // Consume el contador TOTP de forma condicional: el mismo código no sirve dos veces.
  const consumed = await db.prepare("UPDATE staff_accounts SET totp_last_counter = ?, last_login_at = ?, updated_at = ? WHERE email = ? AND (totp_last_counter IS NULL OR totp_last_counter < ?)").bind(counter, at.toISOString(), at.toISOString(), email, counter).run();
  if ((consumed.meta?.changes ?? 0) !== 1) {
    await recordFailure(db, keys, at);
    throw INVALID_LOGIN;
  }
  await db.prepare("DELETE FROM staff_login_attempts WHERE key = ?").bind(`email:${email}`).run();
  await auditStaff(db, "staff.login", email, email, {}, at);
  return createSession(db, env, email, at, meta);
}

// ---------------------------------------------------------------------------
// Sesiones
// ---------------------------------------------------------------------------

async function createSession(db: D1Binding, env: AuthEnv, email: string, at: Date, meta: SessionMeta) {
  const token = randomToken();
  const expiresAt = new Date(at.getTime() + SESSION_ABSOLUTE_MS);
  await db.prepare("INSERT INTO staff_sessions (id, email, created_at, expires_at, last_seen_at, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(await sha256Hex(token), email, at.toISOString(), expiresAt.toISOString(), at.toISOString(), meta.ip ? await sha256Hex(`${env.AUTH_SECRET}:${meta.ip}`) : null, meta.userAgent?.slice(0, 200) ?? null).run();
  return { token, expiresAt };
}

/** Verifica la cookie de sesión. Cualquier fallo devuelve null (sin distinguir causas). */
export async function authenticate(db: D1Binding, env: AuthEnv, token: string | null | undefined, at: Date): Promise<StaffIdentity | null> {
  if (!authConfigured(env) || !token || !TOKEN_PATTERN.test(token)) return null;
  const id = await sha256Hex(token);
  const session = await db.prepare("SELECT s.email, s.expires_at, s.last_seen_at, s.created_at, a.password_changed_at FROM staff_sessions s JOIN staff_accounts a ON a.email = s.email WHERE s.id = ? AND s.revoked_at IS NULL").bind(id).first<{ email: string; expires_at: string; last_seen_at: string; created_at: string; password_changed_at: string }>();
  if (!session) return null;
  if (new Date(session.expires_at) <= at || new Date(session.last_seen_at).getTime() + SESSION_IDLE_MS <= at.getTime()) return null;
  if (new Date(session.password_changed_at) > new Date(session.created_at)) return null;
  const role = await resolveStaffRole(db, env, session.email);
  if (!role) return null;
  if (at.getTime() - new Date(session.last_seen_at).getTime() > SESSION_TOUCH_MS) {
    await db.prepare("UPDATE staff_sessions SET last_seen_at = ? WHERE id = ?").bind(at.toISOString(), id).run();
  }
  return { email: session.email, role, sessionId: id };
}

export async function logout(db: D1Binding, token: string | null | undefined, at: Date) {
  if (!token || !TOKEN_PATTERN.test(token)) return;
  await db.prepare("UPDATE staff_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").bind(at.toISOString(), await sha256Hex(token)).run();
}

export async function revokeSessions(db: D1Binding, actor: { email: string; role: StaffRole }, targetEmail: string, at: Date, env: AuthEnv) {
  const email = normalizeStaffEmail(targetEmail);
  if (email !== actor.email) {
    if (roleRank(actor.role) < roleRank("admin")) throw new AuthError("No tienes permiso para esta acción.", 403, "forbidden");
    const targetRole = await resolveStaffRole(db, env, email);
    if (targetRole && roleRank(targetRole) >= roleRank("admin") && actor.role !== "owner") throw new AuthError("Solo un propietario puede cerrar sesiones de administradores.", 403, "forbidden");
  }
  const result = await db.prepare("UPDATE staff_sessions SET revoked_at = ? WHERE email = ? AND revoked_at IS NULL").bind(at.toISOString(), email).run();
  await auditStaff(db, "staff.sessions_revoked", email, actor.email, { revoked: result.meta?.changes ?? 0 }, at);
  return { revoked: result.meta?.changes ?? 0 };
}

// ---------------------------------------------------------------------------
// Cookie de sesión
// ---------------------------------------------------------------------------

export const SESSION_COOKIE = "__Host-pd_staff";
/** Solo para http://localhost, donde no puede usarse el prefijo __Host- (requiere Secure). */
export const DEV_SESSION_COOKIE = "pd_staff_dev";

export function isLocalHost(hostname: string) {
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname.toLowerCase());
}

export function sessionCookie(token: string, expiresAt: Date, requestUrl: string) {
  const url = new URL(requestUrl);
  const secure = url.protocol === "https:";
  if (!secure && !isLocalHost(url.hostname)) throw new AuthError("Inicia sesión solo por HTTPS.", 400, "insecure_transport");
  const name = secure ? SESSION_COOKIE : DEV_SESSION_COOKIE;
  return `${name}=${token}; Path=/; HttpOnly; SameSite=Strict; Expires=${expiresAt.toUTCString()}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookies(requestUrl: string) {
  const secure = new URL(requestUrl).protocol === "https:";
  return [secure ? `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure` : `${DEV_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`];
}

/** Lee el token de la cookie; la variante de desarrollo solo se acepta en localhost por HTTP. */
export function readSessionToken(cookieHeader: string | null | undefined, requestUrl: string) {
  if (!cookieHeader) return null;
  const url = new URL(requestUrl);
  const cookies = new Map(cookieHeader.split(";").map((part) => {
    const index = part.indexOf("=");
    return [part.slice(0, index).trim(), part.slice(index + 1).trim()] as [string, string];
  }));
  if (url.protocol === "https:") return cookies.get(SESSION_COOKIE) ?? null;
  return isLocalHost(url.hostname) ? cookies.get(DEV_SESSION_COOKIE) ?? null : null;
}
