import assert from "node:assert/strict";
import test from "node:test";
import { decryptSecret, encryptSecret, hashPassword, verifyPassword } from "@/lib/auth/crypto";
import * as staff from "@/lib/auth/staff";
import { base32Encode, hotp, verifyTotp } from "@/lib/auth/totp";
import { createTestD1 } from "../prospect/d1-sqlite";
import { addMember, AUTH_ENV, codeFor, enroll, PASSWORD } from "./helpers";

const T0 = new Date("2026-10-19T18:00:00Z");
const later = (ms: number) => new Date(T0.getTime() + ms);
const OWNER = "duena@ipunto.digital";

test("TOTP cumple los vectores de la RFC 6238 y rechaza reutilización", async () => {
  const secret = new TextEncoder().encode("12345678901234567890");
  assert.equal(await hotp(secret, Math.floor(59 / 30)), "287082");
  assert.equal(await hotp(secret, Math.floor(1111111109 / 30)), "081804");
  const b32 = base32Encode(secret);
  const at = new Date(1111111109 * 1000);
  const counter = await verifyTotp(b32, "081804", at);
  assert.equal(counter, Math.floor(1111111109 / 30));
  assert.equal(await verifyTotp(b32, "081804", at, counter), null, "un código usado no vuelve a servir");
  assert.equal(await verifyTotp(b32, "12345", at), null);
});

test("contraseñas PBKDF2 y secretos cifrados con AES-GCM", async () => {
  const stored = await hashPassword(PASSWORD);
  assert.match(stored, /^pbkdf2-sha256\$100000\$/);
  assert.ok(await verifyPassword(PASSWORD, stored));
  assert.ok(!(await verifyPassword(`${PASSWORD}x`, stored)));
  assert.ok(!(await verifyPassword(PASSWORD, "pbkdf2-sha256$1$aa$bb")), "rechaza iteraciones débiles");
  const sealed = await encryptSecret("SECRETO", AUTH_ENV.AUTH_SECRET!);
  assert.equal(await decryptSecret(sealed, AUTH_ENV.AUTH_SECRET!), "SECRETO");
  await assert.rejects(decryptSecret(sealed, "otra-clave".repeat(5)), "otra clave no descifra");
});

test("configuración inicial: solo propietarios de ADMIN_EMAIL, solo sin cuentas y con el token exacto", async () => {
  const db = createTestD1();
  await assert.rejects(staff.startEnrollment(db, AUTH_ENV, { email: "intruso@x.com", token: AUTH_ENV.AUTH_SETUP_TOKEN! }, T0), (e: staff.AuthError) => e.code === "invalid_token");
  await assert.rejects(staff.startEnrollment(db, AUTH_ENV, { email: OWNER, token: `${AUTH_ENV.AUTH_SETUP_TOKEN}x` }, T0), (e: staff.AuthError) => e.code === "invalid_token");
  await assert.rejects(staff.startEnrollment(db, { ...AUTH_ENV, AUTH_SETUP_TOKEN: "corto" }, { email: OWNER, token: "corto" }, T0), (e: staff.AuthError) => e.code === "invalid_token");
  const { secret } = await staff.startEnrollment(db, AUTH_ENV, { email: OWNER, token: AUTH_ENV.AUTH_SETUP_TOKEN! }, T0);
  await assert.rejects(staff.finishEnrollment(db, AUTH_ENV, { email: OWNER, token: AUTH_ENV.AUTH_SETUP_TOKEN!, password: "corta", secret, code: await codeFor(secret, T0) }, T0), (e: staff.AuthError) => e.code === "weak_password");
  await assert.rejects(staff.finishEnrollment(db, AUTH_ENV, { email: OWNER, token: AUTH_ENV.AUTH_SETUP_TOKEN!, password: PASSWORD, secret, code: "000000" }, T0), (e: staff.AuthError) => e.code === "invalid_code");
  const session = await staff.finishEnrollment(db, AUTH_ENV, { email: OWNER, token: AUTH_ENV.AUTH_SETUP_TOKEN!, password: PASSWORD, secret, code: await codeFor(secret, T0) }, T0);
  assert.deepEqual(await staff.authenticate(db, AUTH_ENV, session.token, T0), { email: OWNER, role: "owner", sessionId: (await staff.authenticate(db, AUTH_ENV, session.token, T0))!.sessionId });
  await assert.rejects(staff.startEnrollment(db, { ...AUTH_ENV, ADMIN_EMAIL: `${OWNER},otro@ipunto.digital` }, { email: "otro@ipunto.digital", token: AUTH_ENV.AUTH_SETUP_TOKEN! }, T0), (e: staff.AuthError) => e.code === "setup_used", "el token de configuración no sirve una vez creada una cuenta");
});

test("inicio de sesión: mensaje genérico, bloqueo tras 5 fallos y códigos de un solo uso", async () => {
  const db = createTestD1();
  const { secret } = await enroll(db, OWNER, AUTH_ENV.AUTH_SETUP_TOKEN!, T0);
  const t1 = later(60_000);
  const unknown = await staff.login(db, AUTH_ENV, { email: "nadie@ipunto.digital", password: PASSWORD, code: "123456" }, t1).catch((e) => e);
  const wrongPassword = await staff.login(db, AUTH_ENV, { email: OWNER, password: "incorrecta-123456", code: await codeFor(secret, t1) }, t1).catch((e) => e);
  assert.equal(unknown.message, wrongPassword.message, "no revela si la cuenta existe");
  assert.equal(unknown.status, 401);
  const ok = await staff.login(db, AUTH_ENV, { email: OWNER, password: PASSWORD, code: await codeFor(secret, t1) }, t1);
  assert.ok(ok.token);
  await assert.rejects(staff.login(db, AUTH_ENV, { email: OWNER, password: PASSWORD, code: await codeFor(secret, t1) }, t1), (e: staff.AuthError) => e.code === "invalid_credentials", "el mismo código no se reutiliza");
  const t2 = later(5 * 60_000);
  for (let i = 0; i < 4; i += 1) await staff.login(db, AUTH_ENV, { email: OWNER, password: "mala-clave-12345", code: "000000" }, t2).catch(() => null);
  await assert.rejects(staff.login(db, AUTH_ENV, { email: OWNER, password: PASSWORD, code: await codeFor(secret, t2) }, t2), (e: staff.AuthError) => e.code === "locked");
  const t3 = later(5 * 60_000 + 16 * 60_000);
  assert.ok((await staff.login(db, AUTH_ENV, { email: OWNER, password: PASSWORD, code: await codeFor(secret, t3) }, t3)).token, "el bloqueo expira");
});

test("bloqueo por IP protege contra ataques a muchas cuentas", async () => {
  const db = createTestD1();
  for (let i = 0; i < 5; i += 1) await staff.login(db, AUTH_ENV, { email: `x${i}@ipunto.digital`, password: "mala-clave-12345", code: "000000" }, T0, { ip: "203.0.113.9" }).catch(() => null);
  await assert.rejects(staff.login(db, AUTH_ENV, { email: "otro@ipunto.digital", password: PASSWORD, code: "000000" }, T0, { ip: "203.0.113.9" }), (e: staff.AuthError) => e.code === "locked");
});

test("sesiones: caducan, expiran por inactividad, se revocan y no aceptan tokens inventados", async () => {
  const db = createTestD1();
  const { session } = await enroll(db, OWNER, AUTH_ENV.AUTH_SETUP_TOKEN!, T0);
  assert.ok(await staff.authenticate(db, AUTH_ENV, session.token, later(60 * 60_000)));
  assert.equal(await staff.authenticate(db, AUTH_ENV, session.token, later(60 * 60_000 + staff.SESSION_IDLE_MS + 1)), null, "inactividad");
  assert.equal(await staff.authenticate(db, AUTH_ENV, session.token, later(staff.SESSION_ABSOLUTE_MS + 1)), null, "caducidad absoluta");
  assert.equal(await staff.authenticate(db, AUTH_ENV, "a".repeat(43), T0), null, "token inventado");
  assert.equal(await staff.authenticate(db, AUTH_ENV, `${session.token}x`, T0), null, "token alterado");
  assert.equal(await staff.authenticate(db, { ...AUTH_ENV, AUTH_SECRET: "" }, session.token, T0), null, "sin AUTH_SECRET no hay sesiones");
  await staff.logout(db, session.token, T0);
  assert.equal(await staff.authenticate(db, AUTH_ENV, session.token, T0), null, "cerrada");
});

test("invitaciones: un solo uso, con vencimiento, ligadas al correo y con reglas de privilegio", async () => {
  const db = createTestD1();
  const owner = await enroll(db, OWNER, AUTH_ENV.AUTH_SETUP_TOKEN!, T0);
  const ownerActor = { email: OWNER, role: "owner" as const };
  await assert.rejects(staff.issueCredentialToken(db, AUTH_ENV, ownerActor, "sinrol@ipunto.digital", T0), (e: staff.AuthError) => e.code === "no_role");
  await addMember(db, "admin@ipunto.digital", "admin");
  await addMember(db, "operador@ipunto.digital", "operator");
  const adminInvite = await staff.issueCredentialToken(db, AUTH_ENV, ownerActor, "admin@ipunto.digital", T0);
  await assert.rejects(staff.startEnrollment(db, AUTH_ENV, { email: "operador@ipunto.digital", token: adminInvite.token }, T0), (e: staff.AuthError) => e.code === "invalid_token", "la invitación está ligada a un correo");
  const admin = await enroll(db, "admin@ipunto.digital", adminInvite.token, T0);
  await assert.rejects(staff.startEnrollment(db, AUTH_ENV, { email: "admin@ipunto.digital", token: adminInvite.token }, T0), (e: staff.AuthError) => e.code === "invalid_token", "un solo uso");
  const adminActor = { email: "admin@ipunto.digital", role: "admin" as const };
  await assert.rejects(staff.issueCredentialToken(db, AUTH_ENV, adminActor, OWNER, T0), (e: staff.AuthError) => e.code === "forbidden", "un admin no restablece a la propietaria");
  await assert.rejects(staff.issueCredentialToken(db, AUTH_ENV, adminActor, "admin@ipunto.digital", T0), (e: staff.AuthError) => e.code === "self_change");
  await assert.rejects(staff.issueCredentialToken(db, AUTH_ENV, { email: "operador@ipunto.digital", role: "operator" }, "admin@ipunto.digital", T0), (e: staff.AuthError) => e.code === "forbidden");
  const opInvite = await staff.issueCredentialToken(db, AUTH_ENV, adminActor, "operador@ipunto.digital", T0);
  await assert.rejects(staff.startEnrollment(db, AUTH_ENV, { email: "operador@ipunto.digital", token: opInvite.token }, later(staff.CREDENTIAL_TOKEN_MS + 1)), (e: staff.AuthError) => e.code === "invalid_token", "vence");
  const second = await staff.issueCredentialToken(db, AUTH_ENV, adminActor, "operador@ipunto.digital", T0);
  await assert.rejects(staff.startEnrollment(db, AUTH_ENV, { email: "operador@ipunto.digital", token: opInvite.token }, T0), (e: staff.AuthError) => e.code === "invalid_token", "emitir otra invalida la anterior");
  await enroll(db, "operador@ipunto.digital", second.token, T0);
  // Restablecer cierra todas las sesiones previas de esa persona.
  const reset = await staff.issueCredentialToken(db, AUTH_ENV, ownerActor, "admin@ipunto.digital", T0);
  assert.equal(reset.purpose, "reset");
  assert.ok(await staff.authenticate(db, AUTH_ENV, admin.session.token, T0));
  await enroll(db, "admin@ipunto.digital", reset.token, later(60_000));
  assert.equal(await staff.authenticate(db, AUTH_ENV, admin.session.token, later(60_000)), null);
  assert.ok(await staff.authenticate(db, AUTH_ENV, owner.session.token, later(60_000)));
});

test("el rol se resuelve en cada solicitud: baja, desactivación y cambios surten efecto de inmediato", async () => {
  const db = createTestD1();
  const ownerActor = { email: OWNER, role: "owner" as const };
  await enroll(db, OWNER, AUTH_ENV.AUTH_SETUP_TOKEN!, T0);
  await addMember(db, "revisor@ipunto.digital", "reviewer");
  const invite = await staff.issueCredentialToken(db, AUTH_ENV, ownerActor, "revisor@ipunto.digital", T0);
  const { session } = await enroll(db, "revisor@ipunto.digital", invite.token, T0);
  assert.equal((await staff.authenticate(db, AUTH_ENV, session.token, T0))?.role, "reviewer");
  await addMember(db, "revisor@ipunto.digital", "viewer");
  assert.equal((await staff.authenticate(db, AUTH_ENV, session.token, T0))?.role, "viewer", "degradar aplica de inmediato");
  await addMember(db, "revisor@ipunto.digital", "owner");
  assert.equal(await staff.authenticate(db, AUTH_ENV, session.token, T0), null, "el rol owner solo viene de ADMIN_EMAIL");
  await addMember(db, "revisor@ipunto.digital", "reviewer", 0);
  assert.equal(await staff.authenticate(db, AUTH_ENV, session.token, T0), null, "desactivado");
  assert.equal(await staff.authenticate(db, { ...AUTH_ENV, ADMIN_EMAIL: "" }, (await staff.login(db, AUTH_ENV, { email: OWNER, password: PASSWORD, code: await codeFor(await enrollSecretFor(db, OWNER), later(60_000)) }, later(60_000))).token, later(60_000)), null, "quitar de ADMIN_EMAIL retira el acceso");
  await staff.revokeSessions(db, ownerActor, OWNER, later(60_000), AUTH_ENV);
});

async function enrollSecretFor(db: ReturnType<typeof createTestD1>, email: string) {
  const row = await db.prepare("SELECT totp_secret_enc FROM staff_accounts WHERE email = ?").bind(email).first<{ totp_secret_enc: string }>();
  return decryptSecret(row!.totp_secret_enc, AUTH_ENV.AUTH_SECRET!);
}

test("cookie: __Host- con Secure en HTTPS; la variante de desarrollo solo en localhost por HTTP", () => {
  const exp = later(1000);
  const prod = staff.sessionCookie("t".repeat(43), exp, "https://www.ipunto.digital/api/auth/login");
  assert.match(prod, /^__Host-pd_staff=/);
  for (const flag of ["HttpOnly", "SameSite=Strict", "Secure", "Path=/"]) assert.ok(prod.includes(flag), flag);
  assert.match(staff.sessionCookie("t".repeat(43), exp, "http://localhost:3000/x"), /^pd_staff_dev=/);
  assert.throws(() => staff.sessionCookie("t".repeat(43), exp, "http://www.ipunto.digital/x"), (e: staff.AuthError) => e.code === "insecure_transport");
  const header = `pd_staff_dev=${"a".repeat(43)}; __Host-pd_staff=${"b".repeat(43)}`;
  assert.equal(staff.readSessionToken(header, "https://www.ipunto.digital/admin"), "b".repeat(43));
  assert.equal(staff.readSessionToken(`pd_staff_dev=${"a".repeat(43)}`, "https://www.ipunto.digital/admin"), null, "la cookie de desarrollo no vale en producción");
  assert.equal(staff.readSessionToken(`pd_staff_dev=${"a".repeat(43)}`, "http://evil.example/admin"), null);
});
