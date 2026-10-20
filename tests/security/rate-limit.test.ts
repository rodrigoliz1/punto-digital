import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as staff from "@/lib/auth/staff";
import { checkRateLimit, d1RateLimitStore, memoryRateLimitStore, RATE_LIMITS, resetMemoryRateLimits, trustedClientIp } from "@/lib/security/rate-limit";
import { addMember, AUTH_ENV, enroll } from "../auth/helpers";
import { createTestD1 } from "../prospect/d1-sqlite";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ORIGIN = "https://equipo.ipunto.digital";
Object.assign(process.env, { PRIVATE_SURFACES_ENABLED: "true", PROSPECT_OS_ENABLED: "true", AUTH_SECRET: AUTH_ENV.AUTH_SECRET, AUTH_SETUP_TOKEN: AUTH_ENV.AUTH_SETUP_TOKEN, ADMIN_EMAIL: AUTH_ENV.ADMIN_EMAIL });
delete process.env.VERCEL;
const db = createTestD1();
globalThis.__PUNTO_DIGITAL_DB__ = db;
globalThis.__PUNTO_DIGITAL_RUNTIME__ = "cloudflare";
const reset = () => db.raw.exec("DELETE FROM request_rate_limits");

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
async function call(route: string, method: string, opts: { params?: Record<string, string>; headers?: Record<string, string>; body?: unknown; url?: string } = {}) {
  const mod = (await import(pathToFileURL(join(ROOT, route)).href)) as Record<string, Handler>;
  const init: RequestInit = { method, headers: { origin: ORIGIN, "content-type": "application/json", "idempotency-key": crypto.randomUUID(), ...opts.headers } };
  if (method !== "GET") init.body = JSON.stringify(opts.body ?? {});
  return mod[method](new Request(opts.url ?? `${ORIGIN}/x`, init), { params: Promise.resolve(opts.params ?? {}) });
}
async function statuses(n: number, fn: () => Promise<Response>) {
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) out.push((await fn()).status);
  return out;
}

test("ventana fija: permite hasta el límite, bloquea después y se reinicia", async () => {
  resetMemoryRateLimits();
  const policy = { id: "t", limit: 3, windowSeconds: 60 };
  const at = new Date("2026-10-20T12:00:10Z");
  const results = [];
  for (let i = 0; i < 4; i += 1) results.push(await checkRateLimit(memoryRateLimitStore, policy, "s", at));
  assert.deepEqual(results.map((r) => r.allowed), [true, true, true, false]);
  assert.equal(results[3].retryAfter, 50);
  assert.equal((await checkRateLimit(memoryRateLimitStore, policy, "s", new Date("2026-10-20T12:01:00Z"))).allowed, true, "nueva ventana");
  assert.equal((await checkRateLimit(memoryRateLimitStore, policy, "otro", at)).allowed, true, "sujetos independientes");
});

test("almacén D1: contador atómico compartido (RETURNING) y aislado por política", async () => {
  reset();
  const store = d1RateLimitStore(db);
  const at = new Date("2026-10-20T12:00:00Z");
  for (let i = 1; i <= 5; i += 1) assert.equal((await checkRateLimit(store, RATE_LIMITS.publicFormMinute, "ip:a", at)).count, i);
  assert.equal((await checkRateLimit(store, RATE_LIMITS.publicFormMinute, "ip:a", at)).allowed, false);
  assert.equal((await checkRateLimit(store, RATE_LIMITS.checkout, "ip:a", at)).allowed, true);
  const keys = db.raw.prepare("SELECT key FROM request_rate_limits").all() as Array<{ key: string }>;
  assert.ok(keys.every((k) => !/\d+\.\d+\.\d+\.\d+/.test(k.key)), "no se guardan IPs en claro");
});

test("la IP solo proviene de la cabecera de la plataforma", () => {
  const request = new Request("https://x", { headers: { "cf-connecting-ip": "203.0.113.1", "x-forwarded-for": "198.51.100.7", "x-real-ip": "198.51.100.8" } });
  assert.equal(trustedClientIp(request), "203.0.113.1", "Cloudflare: cf-connecting-ip");
  globalThis.__PUNTO_DIGITAL_RUNTIME__ = undefined;
  assert.equal(trustedClientIp(request), null, "sin plataforma reconocida no se confía en cabeceras");
  process.env.VERCEL = "1";
  assert.equal(trustedClientIp(request), "198.51.100.8", "Vercel: x-real-ip");
  delete process.env.VERCEL;
  globalThis.__PUNTO_DIGITAL_RUNTIME__ = "cloudflare";
});

test("formularios públicos: 5 por minuto por IP, sin que cambiar X-Forwarded-For lo evite", async () => {
  reset();
  for (const route of ["app/api/leads/route.ts", "app/api/contact/route.ts"]) {
    reset();
    const result = await statuses(7, () => call(route, "POST", { headers: { "cf-connecting-ip": "203.0.113.10", "x-forwarded-for": crypto.randomUUID() } }));
    assert.deepEqual(result.slice(0, 5).every((s) => s !== 429), true, `${route}: ${result}`);
    assert.deepEqual(result.slice(5), [429, 429], `${route}: ${result}`);
  }
  const other = await call("app/api/leads/route.ts", "POST", { headers: { "cf-connecting-ip": "203.0.113.11" } });
  assert.notEqual(other.status, 429, "otra IP no se ve afectada");
});

test("correo de transferencia y checkout limitados (sin llegar a enviar nada)", async () => {
  reset();
  const transfer = await statuses(4, () => call("app/api/send-transfer-email/route.ts", "POST", { headers: { "cf-connecting-ip": "203.0.113.20" } }));
  assert.deepEqual(transfer.slice(0, 3).map((s) => s === 400), [true, true, true], `datos inválidos rechazados antes de enviar: ${transfer}`);
  assert.equal(transfer[3], 429);
  const checkout = await statuses(11, () => call("app/api/checkout/route.ts", "POST", { headers: { "cf-connecting-ip": "203.0.113.21" } }));
  assert.equal(checkout[10], 429);
  const limited = await call("app/api/checkout/route.ts", "POST", { headers: { "cf-connecting-ip": "203.0.113.21" } });
  assert.ok(Number(limited.headers.get("retry-after")) > 0, "incluye Retry-After");
});

test("acceso del equipo: 20 solicitudes por minuto por IP en /api/auth", async () => {
  reset();
  const login = await statuses(6, () => call("app/api/auth/[action]/route.ts", "POST", { params: { action: "login" }, headers: { "cf-connecting-ip": "203.0.113.30" }, body: { email: "x@ipunto.digital", password: "x", code: "000000" } }));
  assert.deepEqual(login, [401, 401, 401, 401, 401, 429], "el bloqueo de login por IP actúa desde el 5.º fallo");
  reset();
  const enrollTries = await statuses(22, () => call("app/api/auth/[action]/route.ts", "POST", { params: { action: "enroll-start" }, headers: { "cf-connecting-ip": "203.0.113.31" }, body: { email: "x@ipunto.digital", token: "token-adivinado-1234" } }));
  assert.ok(enrollTries.slice(0, 20).every((s) => s === 400), String(enrollTries));
  assert.deepEqual(enrollTries.slice(20), [429, 429], "adivinar tokens de activación también se frena");
});

test("demos: 60 vistas por minuto por IP; tokens inválidos no revelan nada", async () => {
  reset();
  const token = "B".repeat(43);
  const result = await statuses(62, () => call("app/propuesta/[token]/route.ts", "GET", { params: { token }, headers: { "cf-connecting-ip": "203.0.113.40" } }));
  assert.ok(result.slice(0, 60).every((s) => s === 404), "token inexistente: 404");
  assert.deepEqual(result.slice(60), [429, 429]);
});

test("API privada: límite por IP antes de autenticar y límite por persona para acciones de agentes", async () => {
  reset();
  const unauth = await statuses(302, () => call("app/api/prospect/prospects/route.ts", "GET", { headers: { "cf-connecting-ip": "203.0.113.50" } }));
  assert.ok(unauth.slice(0, 300).every((s) => s === 401));
  assert.deepEqual(unauth.slice(300), [429, 429], "sin sesión también se frena");
  reset();
  const at = new Date();
  await enroll(db, AUTH_ENV.ADMIN_EMAIL!, AUTH_ENV.AUTH_SETUP_TOKEN!, at).catch(() => null);
  await addMember(db, "operador@ipunto.digital", "operator");
  const invite = await staff.issueCredentialToken(db, AUTH_ENV, { email: AUTH_ENV.ADMIN_EMAIL!, role: "owner" }, "operador@ipunto.digital", at);
  const { session } = await enroll(db, "operador@ipunto.digital", invite.token, at);
  const cookie = `__Host-pd_staff=${session.token}`;
  const fakeId = "pro_0123456789abcdef0123456789abcdef";
  const agent = await statuses(22, () => call("app/api/prospect/prospects/[id]/[action]/route.ts", "POST", { params: { id: fakeId, action: "analyze" }, headers: { cookie, "cf-connecting-ip": `198.51.100.${Math.floor(Math.random() * 200)}` } }));
  assert.ok(agent.slice(0, 20).every((s) => s === 404), `prospecto inexistente: ${agent}`);
  assert.deepEqual(agent.slice(20), [429, 429], "cambiar de IP no evita el límite por persona");
  const light = await call("app/api/prospect/prospects/[id]/[action]/route.ts", "POST", { params: { id: fakeId, action: "qualify" }, headers: { cookie, "cf-connecting-ip": "198.51.100.250" } });
  assert.equal(light.status, 404, "las acciones ligeras siguen disponibles");
});
