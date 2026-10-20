/**
 * Recorrido E2E del panel en Chrome headless (protocolo DevTools, sin dependencias).
 * Requiere un servidor local con una base D1 local recién migrada y sin cuentas, y estas variables:
 *   E2E_BASE_URL (por defecto http://localhost:3100), E2E_SETUP_TOKEN (= AUTH_SETUP_TOKEN del servidor),
 *   E2E_OWNER_EMAIL (= ADMIN_EMAIL), E2E_OUTPUT (carpeta de capturas, por defecto ./e2e-output).
 * Nunca lo ejecutes contra producción: crea cuentas, prospectos y exclusiones de prueba.
 */
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launch, totp } from "./cdp.mjs";

const B = process.env.E2E_BASE_URL ?? "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(B)) throw new Error("E2E solo contra localhost.");
const OWNER = process.env.E2E_OWNER_EMAIL ?? "owner@local.test";
const SETUP = process.env.E2E_SETUP_TOKEN ?? "";
if (SETUP.length < 32) throw new Error("Define E2E_SETUP_TOKEN (igual a AUTH_SETUP_TOKEN del servidor).");
const SHOTS = process.env.E2E_OUTPUT ?? "e2e-output";
mkdirSync(SHOTS, { recursive: true });
const PASS = "contraseña-de-prueba-larga-2026";
const profile = join(tmpdir(), `pd-e2e-chrome-${Date.now()}`);
const page = await launch(profile);
await page.viewport(1440, 900);
const results = [];
async function step(name, fn) {
  const before = page.errors.length;
  try {
    const detail = await fn();
    const errs = page.errors.slice(before);
    results.push(`${errs.length ? "⚠" : "✔"} ${name}${detail ? ` — ${detail}` : ""}${errs.length ? `\n     ${errs.join("\n     ")}` : ""}`);
  } catch (error) {
    results.push(`✖ ${name} — ${error.message.split("\n")[0]}`);
    await page.shot(`${SHOTS}/FAIL-${name.replace(/\W+/g, "_").slice(0, 40)}.png`, false).catch(() => {});
  }
}
const expectText = async (fragment) => { const t = await page.text(); if (!t.toLowerCase().includes(fragment.toLowerCase())) throw new Error(`no aparece «${fragment}»`); };

await step("sin sesión, el panel redirige al acceso", async () => {
  await page.goto(`${B}/admin/prospectos`);
  const url = await page.url();
  if (!url.startsWith("/admin/acceso")) throw new Error(url);
  await page.shot(`${SHOTS}/01-login.png`);
  return url;
});
await step("credenciales falsas muestran error genérico", async () => {
  await page.fill('input[name="email"]', OWNER);
  await page.fill('input[name="password"]', "incorrecta-1234567");
  await page.fill('input[name="code"]', "000000");
  await page.click("Entrar");
  await expectText("Correo, contraseña o código incorrectos.");
});
let secret;
await step("activación de la primera cuenta (token de configuración + TOTP)", async () => {
  await page.goto(`${B}/admin/acceso/activar`);
  await page.fill('input[name="email"]', OWNER);
  await page.fill('input[name="token"]', SETUP);
  await page.click("Continuar");
  secret = (await page.eval("document.querySelector('.po-secret')?.textContent ?? ''")).replace(/\s/g, "");
  if (secret.length !== 32) throw new Error(`secreto: ${secret}`);
  await page.shot(`${SHOTS}/02-activar-paso2.png`);
  await page.fill('input[name="password"]', PASS);
  await page.fill('input[name="confirm"]', PASS);
  await page.fill('input[name="code"]', totp(secret));
  await page.click("Activar acceso");
  await page.settle(1500);
  const url = await page.url();
  if (url !== "/admin") throw new Error(`terminó en ${url}`);
  await page.shot(`${SHOTS}/03-admin.png`);
  return url;
});
await step("el token de configuración no sirve dos veces", async () => {
  const r = await page.eval(`fetch('/api/auth/enroll-start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: ${JSON.stringify(OWNER)}, token: ${JSON.stringify(SETUP)} }) }).then((r) => r.status)`);
  if (r !== 409) throw new Error(`status ${r}`);
  return "409";
});
await step("desde /admin se abre Prospect OS", async () => {
  await page.click("Abrir Prospect OS");
  if ((await page.url()) !== "/admin/prospectos") throw new Error(await page.url());
  await page.shot(`${SHOTS}/04-resumen-vacio.png`);
});
await step("configuración: alta de revisor e invitación de un solo uso", async () => {
  await page.goto(`${B}/admin/prospectos/configuracion`);
  await page.fill('input[name="email"][type="email"]', "revisora@local.test");
  await page.eval("(() => { const s = [...document.querySelectorAll('select[name=role]')].pop(); s.value = 'reviewer'; s.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await page.click("Guardar miembro");
  await page.goto(`${B}/admin/prospectos/configuracion`);
  await expectText("revisora@local.test");
  await page.click("Generar invitación");
  const link = await page.eval("[...document.querySelectorAll('.po-copy pre')].map((p) => p.textContent).find((t) => t.includes('/admin/acceso/activar')) ?? ''");
  if (!link.includes("token=")) throw new Error("sin enlace");
  await page.shot(`${SHOTS}/05-configuracion.png`);
  return link.replace(/token=[^&]+/, "token=…");
});
await step("Google Places sin presupuesto muestra el bloqueo", async () => {
  await page.goto(`${B}/admin/prospectos/descubrir`);
  await page.click("Buscar negocios");
  await expectText("está deshabilitado");
});
let prospectPath;
await step("alta manual redirige a la ficha", async () => {
  const set = (name, value) => page.fill(`form:has(button[type=submit]) [name="${name}"]`, value);
  await page.eval("document.querySelectorAll('.po-panel')[1].scrollIntoView()");
  const scope = ".po-grid-2 .po-panel:first-child";
  for (const [name, value] of [["name", "Café Ejemplo Providencia"], ["category", "cafetería"], ["zone", "Providencia"], ["sourceUrl", "https://example.com/directorio"], ["website", "https://example.com"], ["emailPublic", "hola@example.com"]]) await page.fill(`${scope} [name="${name}"]`, value);
  void set;
  await page.click("Agregar prospecto", scope);
  await page.settle(1500);
  prospectPath = await page.url();
  if (!prospectPath.startsWith("/admin/prospectos/p/pro_")) throw new Error(prospectPath);
  return prospectPath;
});
await step("analista de marca lee el sitio público (example.com)", async () => {
  await page.click("1 · Analizar sitio web");
  await page.settle(2500);
  await expectText("Example Domain");
});
await step("señales y calificación", async () => {
  await page.click("Editar señales");
  for (const [k, v] of [["budget_fit", "4"], ["posts_last_28d", "3"], ["product_quality", "4"], ["contact_quality", "4"], ["service_fit", "5"]]) await page.fill(`[name="signals.${k}"]`, v);
  await page.click("Guardar y recalcular");
  await page.click("2 · Calificar");
  await expectText("Calificado");
});
await step("brief determinista", async () => { await page.click("3 · Brief determinista"); await expectText("deterministic:v1"); });
await step("brief con Claude sin credencial informa el motivo", async () => { await page.click("3 · Brief con Claude"); await expectText("Falta ANTHROPIC_API_KEY"); });
await step("imágenes sin proveedor informa el motivo", async () => { await page.click("4 · Generar 3 imágenes"); await expectText("No hay proveedor de imágenes"); });
await step("demo y aprobación humana", async () => {
  await page.click("5 · Construir demo");
  await expectText("Demo lista");
  await page.click("6 · Aprobar prospecto y demo");
  await expectText("Aprobado");
});
let demoUrl;
let oldDemoUrl;
await step("enlace privado de la demo", async () => {
  await page.click("Generar enlace privado (14 días)");
  demoUrl = await page.eval("[...document.querySelectorAll('.po-copy pre')].map((p) => p.textContent).find((t) => t.includes('/propuesta/')) ?? ''");
  if (!demoUrl) throw new Error("sin enlace");
  return demoUrl.replace(/propuesta\/.+/, "propuesta/…");
});
await step("redacción, revisión y aprobación del mensaje", async () => {
  await page.click("Redactar borrador");
  await expectText("Prospecto aprobado por una persona");
  await page.click("Aprobar mensaje");
  await expectText("Preparar texto para envío manual");
});
await step("preparar envío manual y registrarlo", async () => {
  await page.click("Preparar texto para envío manual");
  const body = await page.eval("[...document.querySelectorAll('.po-prepared .po-copy pre')].map((p) => p.textContent).join('\\n')");
  if (!body.includes("/propuesta/") || body.includes("{{enlace_propuesta}}")) throw new Error("texto sin enlace");
  oldDemoUrl = demoUrl;
  demoUrl = body.match(/https?:\/\/\S+\/propuesta\/[A-Za-z0-9_-]{43}/)[0];
  await page.shot(`${SHOTS}/06-preparar-envio.png`, false);
  await page.click("Registrar que lo envié");
  await expectText("Contactado");
});
await step("respuesta, reunión y cierre", async () => {
  const activity = async (type, summary, extra = {}) => {
    await page.eval(`(() => { const s = document.querySelector('select[name=type]'); s.value = ${JSON.stringify(type)}; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    for (const [k, v] of Object.entries(extra)) await page.fill(`[name="${k}"]`, v);
    await page.fill('textarea[name="summary"]', summary);
    await page.click("Registrar actividad");
  };
  await activity("reply", "Pidió precios del paquete profesional");
  await activity("meeting", "Llamada de 15 minutos", { scheduledAt: "2026-10-22T11:00" });
  await activity("won", "Firmó paquete profesional", { dealValueMxn: "14900" });
  await expectText("Cliente");
  await page.shot(`${SHOTS}/07-ficha.png`);
});
await step("el enlace anterior quedó invalidado al rotar", async () => {
  const status = await page.eval(`fetch(${JSON.stringify(oldDemoUrl)}).then((r) => r.status)`);
  if (status !== 404) throw new Error(`status ${status}`);
  return "404";
});
await step("la demo se ve sin sesión, con avisos de simulación", async () => {
  await page.goto(`${B}/admin/acceso`);
  await page.eval("fetch('/api/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })");
  await page.goto(demoUrl.replace("http://localhost:3100", B));
  await expectText("Simulación conceptual");
  await page.shot(`${SHOTS}/08-demo-escritorio.png`);
  await page.viewport(390, 844, true);
  await page.goto(demoUrl);
  const overflow = await page.horizontalOverflow();
  await page.shot(`${SHOTS}/09-demo-movil.png`);
  await page.viewport(1440, 900);
  if (overflow > 0) throw new Error(`desborde horizontal ${overflow}px`);
});
await step("volver a entrar tras ver la demo", async () => {
  await page.goto(`${B}/admin/acceso`);
  await page.fill('input[name="email"]', OWNER);
  await page.fill('input[name="password"]', PASS);
  await page.fill('input[name="code"]', totp(secret, Date.now(), 1));
  await page.click("Entrar");
  await page.settle(1500);
  if (!(await page.url()).startsWith("/admin")) throw new Error(await page.url());
});
await step("exclusión por correo", async () => {
  await page.goto(`${B}/admin/prospectos/exclusiones`);
  await page.fill('input[name="value"]', "hola@example.com");
  await page.fill('input[name="reason"]', "Prueba de exclusión");
  await page.click("Excluir");
  await expectText("prospectos excluidos: 1");
  await page.goto(`${B}${prospectPath}`);
  await expectText("Prospecto excluido");
});
const PAGES = ["", "/descubrir", "/lista", "/marca", "/demos", "/campanas", "/seguimiento", "/clientes", "/exclusiones", "/costos", "/auditoria", "/configuracion"];
for (const [label, w, h, mobile] of [["escritorio", 1440, 900, false], ["tableta", 820, 1180, true], ["movil", 390, 844, true]]) {
  await page.viewport(w, h, mobile);
  for (const p of [...PAGES, prospectPath.replace("/admin/prospectos", "")]) {
    await step(`${label} ${p || "/"}`, async () => {
      await page.goto(`${B}/admin/prospectos${p}`);
      const h1 = await page.eval("document.querySelector('h1')?.textContent ?? ''");
      const overflow = await page.horizontalOverflow();
      if (label !== "escritorio" || ["", "/lista", "/configuracion"].includes(p)) await page.shot(`${SHOTS}/z-${label}${(p || "/resumen").replace(/\//g, "-").slice(0, 30)}.png`, label === "escritorio");
      if (!h1) throw new Error("sin h1");
      if (overflow > 0) throw new Error(`desborde horizontal ${overflow}px · ${h1}`);
      return h1;
    });
  }
}
await page.viewport(1440, 900);
await step("salir cierra la sesión", async () => {
  await page.goto(`${B}/admin/prospectos`);
  await page.click("Salir");
  await page.goto(`${B}/admin/prospectos`);
  if (!(await page.url()).startsWith("/admin/acceso")) throw new Error(await page.url());
});
await step("volver a entrar con contraseña + código nuevo", async () => {
  await page.fill('input[name="email"]', OWNER);
  await page.fill('input[name="password"]', PASS);
  await page.fill('input[name="code"]', totp(secret, Date.now(), 1));
  await page.click("Entrar");
  await page.settle(1500);
  if ((await page.url()) !== "/admin/prospectos") throw new Error(await page.url());
});
console.log(results.join("\n"));
console.log(`\nDiálogos de confirmación aceptados: ${page.dialogs.length}`);
page.close();
rmSync(profile, { recursive: true, force: true });
process.exitCode = results.some((line) => line.startsWith("✖")) ? 1 : 0;
