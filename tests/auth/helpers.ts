import { base32Decode, hotp, totpCounter } from "@/lib/auth/totp";
import * as staff from "@/lib/auth/staff";
import { createTestD1 } from "../prospect/d1-sqlite";

export const AUTH_ENV: staff.AuthEnv = { AUTH_SECRET: "s".repeat(48), AUTH_SETUP_TOKEN: "setup-".padEnd(40, "x"), ADMIN_EMAIL: "duena@ipunto.digital" };
export const PASSWORD = "una-clave-larga-y-segura-2026";

export async function codeFor(secret: string, at: Date, offset = 0) {
  return hotp(base32Decode(secret), totpCounter(at) + offset);
}

/** Crea una cuenta inscrita y devuelve su secreto TOTP y una sesión válida. */
export async function enroll(db: ReturnType<typeof createTestD1>, email: string, token: string, at: Date, env = AUTH_ENV) {
  const { secret } = await staff.startEnrollment(db, env, { email, token }, at);
  const session = await staff.finishEnrollment(db, env, { email, token, password: PASSWORD, secret, code: await codeFor(secret, at) }, at);
  return { secret, session };
}

export async function addMember(db: ReturnType<typeof createTestD1>, email: string, role: string, active = 1) {
  await db.prepare("INSERT INTO prospect_team (email, role, active, added_by, created_at, updated_at) VALUES (?, ?, ?, 'test', '2026-10-01', '2026-10-01') ON CONFLICT(email) DO UPDATE SET role = excluded.role, active = excluded.active").bind(email, role, active).run();
}
