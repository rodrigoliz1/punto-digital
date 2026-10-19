import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as staff from "@/lib/auth/staff";
import { createTestD1 } from "../prospect/d1-sqlite";
import { addMember, AUTH_ENV, enroll } from "./helpers";

/**
 * Pruebas de suplantación y acceso no autorizado sobre los handlers reales de cada ruta privada.
 * Se descubren todas las rutas en disco: una ruta nueva sin protección hace fallar esta prueba.
 */

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ORIGIN = "https://www.ipunto.digital";
const OWNER = AUTH_ENV.ADMIN_EMAIL!;

Object.assign(process.env, { PRIVATE_SURFACES_ENABLED: "true", PROSPECT_OS_ENABLED: "true", AUTH_SECRET: AUTH_ENV.AUTH_SECRET, AUTH_SETUP_TOKEN: AUTH_ENV.AUTH_SETUP_TOKEN, ADMIN_EMAIL: OWNER, NEXT_PUBLIC_SITE_URL: ORIGIN });
delete process.env.VERCEL;
const db = createTestD1();
globalThis.__PUNTO_DIGITAL_DB__ = db;

function findRoutes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? findRoutes(path) : name === "route.ts" ? [path] : [];
  });
}

const PRIVATE_ROUTES = [...findRoutes(join(ROOT, "app/api/prospect")), ...findRoutes(join(ROOT, "app/admin"))];
const ACTIONS = ["qualify", "analyze", "brief", "images", "demo", "approve", "draft", "activity", "suppress", "edit", "prepare", "sent", "discard", "link", "revoke"];
const SECTIONS = ["agents", "budgets", "team", "campaigns", "purge-places"];
const FAKE_ID = "pro_0123456789abcdef0123456789abcdef";

function urlFor(file: string, params: Record<string, string>) {
  const path = "/" + relative(join(ROOT, "app"), file).replace(/\/route\.ts$/, "").replace(/\[(\w+)\]/g, (_, key) => params[key]);
  return `${ORIGIN}${path}`;
}

function paramSets(file: string) {
  const keys = [...file.matchAll(/\[(\w+)\]/g)].map((m) => m[1]);
  const values: Record<string, string[]> = { id: [FAKE_ID], action: ACTIONS, section: SECTIONS, token: ["A".repeat(43)], assetId: ["ast_0123456789abcdef0123456789abcdef"] };
  return keys.reduce<Array<Record<string, string>>>((sets, key) => sets.flatMap((set) => (values[key] ?? ["x"]).map((value) => ({ ...set, [key]: value }))), [{}]);
}

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

async function call(file: string, method: string, params: Record<string, string>, headers: Record<string, string>, body?: unknown) {
  const mod = (await import(pathToFileURL(file).href)) as Record<string, Handler>;
  const init: RequestInit = { method, headers: { origin: ORIGIN, ...(method === "GET" ? {} : { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }), ...headers } };
  if (method !== "GET") init.body = JSON.stringify(body ?? {});
  return mod[method](new Request(urlFor(file, params), init), { params: Promise.resolve(params) });
}

const SPOOFED_HEADERS: Array<[string, Record<string, string>]> = [
  ["sin credenciales", {}],
  ["encabezado de identidad de plataforma falsificado", { "oai-authenticated-user-email": OWNER, "oai-authenticated-user-full-name": "Dueña" }],
  ["encabezados de proxy falsificados", { "x-user-email": OWNER, "x-forwarded-user": OWNER, "cf-access-authenticated-user-email": OWNER, authorization: `Bearer ${"a".repeat(43)}` }],
  ["cookie de sesión inventada", { cookie: `__Host-pd_staff=${"a".repeat(43)}` }],
  ["cookie de desarrollo en producción", { cookie: `pd_staff_dev=${"a".repeat(43)}` }],
];

test("descubre todas las rutas privadas", () => {
  assert.ok(PRIVATE_ROUTES.length >= 10, `rutas encontradas: ${PRIVATE_ROUTES.length}`);
});

test("ninguna ruta privada responde con éxito sin una sesión válida", async () => {
  let checked = 0;
  for (const file of PRIVATE_ROUTES) {
    const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
    const methods = ["GET", "POST", "PATCH", "PUT", "DELETE"].filter((m) => typeof mod[m] === "function");
    for (const method of methods) {
      for (const params of paramSets(file)) {
        for (const [label, headers] of SPOOFED_HEADERS) {
          const response = await call(file, method, params, headers);
          assert.ok([401, 403, 404, 405].includes(response.status), `${method} ${urlFor(file, params)} (${label}) respondió ${response.status}`);
          checked += 1;
        }
      }
    }
  }
  assert.ok(checked > 100, `combinaciones probadas: ${checked}`);
});

test("las acciones de equipo en /api/auth exigen sesión", async () => {
  const file = join(ROOT, "app/api/auth/[action]/route.ts");
  for (const action of ["invite", "revoke-sessions"]) {
    for (const [label, headers] of SPOOFED_HEADERS) {
      const response = await call(file, "POST", { action }, headers, { email: "alguien@ipunto.digital" });
      assert.equal(response.status, 401, `${action} (${label})`);
    }
  }
});

test("escalamiento de privilegios: cada rol solo puede lo que le corresponde", async () => {
  const at = new Date();
  const owner = await enroll(db, OWNER, AUTH_ENV.AUTH_SETUP_TOKEN!, at);
  const sessions: Record<string, string> = { owner: owner.session.token };
  for (const role of ["viewer", "operator", "reviewer", "admin"]) {
    const email = `${role}@ipunto.digital`;
    await addMember(db, email, role);
    const invite = await staff.issueCredentialToken(db, AUTH_ENV, { email: OWNER, role: "owner" }, email, at);
    sessions[role] = (await enroll(db, email, invite.token, at)).session.token;
  }
  const as = (role: string, extra: Record<string, string> = {}) => ({ cookie: `__Host-pd_staff=${sessions[role]}`, ...extra });
  const prospects = join(ROOT, "app/api/prospect/prospects/route.ts");
  const settings = join(ROOT, "app/api/prospect/settings/[section]/route.ts");
  const auth = join(ROOT, "app/api/auth/[action]/route.ts");
  const newProspect = { name: "Café Prueba", category: "cafetería", city: "Guadalajara", sourceUrl: "https://example.org/cafe" };

  assert.equal((await call(prospects, "GET", {}, as("viewer"))).status, 200, "lectura permitida a viewer");
  assert.equal((await call(prospects, "POST", {}, as("viewer"), newProspect)).status, 403, "viewer no escribe");
  assert.equal((await call(prospects, "POST", {}, as("viewer", { "oai-authenticated-user-email": OWNER }), newProspect)).status, 403, "un encabezado no eleva el rol");
  assert.equal((await call(prospects, "POST", {}, as("operator"), newProspect)).status, 200, "operator crea");
  assert.equal((await call(prospects, "POST", {}, as("operator", { origin: "https://evil.example" }), newProspect)).status, 403, "otro origen bloqueado (CSRF)");

  const budget = { provider: "anthropic", monthlyLimitUsd: 5, enabled: true };
  assert.equal((await call(settings, "POST", { section: "budgets" }, as("reviewer"), budget)).status, 403, "reviewer no cambia presupuestos");
  assert.equal((await call(settings, "POST", { section: "budgets" }, as("admin"), budget)).status, 200, "admin cambia presupuestos");
  assert.equal((await call(settings, "POST", { section: "team" }, as("admin"), { email: "nuevo@ipunto.digital", role: "admin", active: true })).status, 403, "admin no crea administradores");
  assert.equal((await call(settings, "POST", { section: "team" }, as("admin"), { email: "admin@ipunto.digital", role: "reviewer", active: true })).status, 409, "nadie cambia su propio rol");
  assert.equal((await call(settings, "POST", { section: "team" }, as("owner"), { email: "nuevo@ipunto.digital", role: "admin", active: true })).status, 200, "owner crea administradores");
  assert.equal((await call(settings, "POST", { section: "team" }, as("owner"), { email: "x@ipunto.digital", role: "owner", active: true })).status, 400, "el rol owner no se asigna desde el panel");

  assert.equal((await call(auth, "POST", { action: "invite" }, as("operator"), { email: "viewer@ipunto.digital" })).status, 403, "operator no invita");
  assert.equal((await call(auth, "POST", { action: "invite" }, as("admin"), { email: OWNER })).status, 403, "admin no restablece a la propietaria");
  assert.equal((await call(auth, "POST", { action: "invite" }, as("admin"), { email: "viewer@ipunto.digital" })).status, 200, "admin invita a roles menores");
  assert.equal((await call(auth, "POST", { action: "revoke-sessions" }, as("admin"), { email: OWNER })).status, 403, "admin no cierra sesiones de la propietaria");

  // Baja inmediata: desactivar al operador invalida su sesión en la siguiente solicitud.
  await addMember(db, "operator@ipunto.digital", "operator", 0);
  assert.equal((await call(prospects, "GET", {}, as("operator"))).status, 401, "miembro desactivado pierde acceso");

  // Cerrar sesión revoca el token en servidor.
  assert.equal((await call(auth, "POST", { action: "logout" }, as("viewer"))).status, 200);
  assert.equal((await call(prospects, "GET", {}, as("viewer"))).status, 401, "sesión cerrada ya no sirve");
});

test("inicio de sesión por la API: cookie segura y sin sesión ante credenciales falsas", async () => {
  const auth = join(ROOT, "app/api/auth/[action]/route.ts");
  const bad = await call(auth, "POST", { action: "login" }, {}, { email: OWNER, password: "incorrecta-123456", code: "000000" });
  assert.equal(bad.status, 401);
  assert.equal(bad.headers.get("set-cookie"), null);
  assert.equal((await call(auth, "POST", { action: "login" }, { origin: "https://evil.example" }, { email: OWNER, password: "x", code: "000000" })).status, 403, "login desde otro origen bloqueado");
});

test("con PROSPECT_OS_ENABLED apagado, el módulo no responde aunque haya sesión", async () => {
  const prospects = join(ROOT, "app/api/prospect/prospects/route.ts");
  process.env.PROSPECT_OS_ENABLED = "false";
  try {
    assert.equal((await call(prospects, "GET", {}, {})).status, 404);
  } finally {
    process.env.PROSPECT_OS_ENABLED = "true";
  }
});
