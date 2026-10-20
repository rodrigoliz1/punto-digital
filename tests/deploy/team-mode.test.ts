import assert from "node:assert/strict";
import test from "node:test";
import { teamRoute } from "@/lib/deploy/team-mode";

const PUBLIC = "https://www.ipunto.digital";
const route = (path: string, method = "GET") => teamRoute(new URL(path, "https://equipo.ipunto.digital"), method, PUBLIC);

test("modo equipo: sirve solo panel, acceso, API privada y demos", () => {
  for (const path of ["/admin", "/admin/acceso", "/admin/prospectos/lista?status=qualified", "/admin/prospectos.rsc", "/api/auth/login", "/api/prospect/prospects", `/propuesta/${"A".repeat(43)}`, "/_vinext/image"]) {
    assert.deepEqual(route(path, path.startsWith("/api/") ? "POST" : "GET"), { action: "pass" }, path);
  }
});

test("modo equipo: lo público redirige a www y las APIs públicas no existen", () => {
  assert.deepEqual(route("/"), { action: "redirect", location: "/admin", status: 302 });
  assert.deepEqual(route("/servicios?x=1"), { action: "redirect", location: "https://www.ipunto.digital/servicios?x=1", status: 308 });
  assert.deepEqual(route("/cotizador"), { action: "redirect", location: "https://www.ipunto.digital/cotizador", status: 308 });
  for (const path of ["/api/leads", "/api/contact", "/api/checkout", "/api/stripe/webhook", "/api/upload"]) assert.deepEqual(route(path, "POST"), { action: "not_found" }, path);
  assert.deepEqual(route("/cliente", "POST"), { action: "not_found" });
  assert.deepEqual(route("/robots.txt"), { action: "robots" });
});

test("modo equipo: prefijos parecidos no se cuelan", () => {
  assert.equal(route("/administracion").action, "redirect");
  assert.equal(route("/api/prospectos", "POST").action, "not_found");
  assert.equal(route("/propuestas").action, "redirect");
});
