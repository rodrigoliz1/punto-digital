// Cliente mínimo del protocolo DevTools de Chrome (WebSocket nativo de Node 24).
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";

export async function launch(profileDir, port = 9333) {
  const proc = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--disable-extensions", "--disable-sync", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
  let targets;
  for (let i = 0; i < 50; i += 1) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.some((t) => t.type === "page")) break; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) { const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id); if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result); }
    else if (msg.method) for (const fn of listeners.get(msg.method) ?? []) fn(msg.params);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { id += 1; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  const on = (method, fn) => listeners.set(method, [...(listeners.get(method) ?? []), fn]);
  const errors = [];
  on("Runtime.exceptionThrown", (p) => errors.push(`exception: ${p.exceptionDetails?.exception?.description?.split("\n")[0] ?? p.exceptionDetails?.text}`));
  on("Runtime.consoleAPICalled", (p) => { if (p.type === "error") errors.push(`console.error: ${p.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200)}`); });
  on("Log.entryAdded", (p) => { if (p.entry.level === "error" && !/favicon/.test(p.entry.url ?? "") && !/manifest\.webmanifest/.test(p.entry.text)) errors.push(`log: ${p.entry.text.slice(0, 160)} ${p.entry.url ?? ""}`); });
  let dialogs = [];
  on("Page.javascriptDialogOpening", async (p) => { dialogs.push(p.message); await send("Page.handleJavaScriptDialog", { accept: true }); });
  await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable"); await send("Network.enable");

  const api = {
    send, errors, get dialogs() { return dialogs; },
    async viewport(width, height, mobile = false) { await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile }); },
    async goto(url) {
      const loaded = new Promise((r) => { const fn = () => r(); on("Page.loadEventFired", fn); });
      await send("Page.navigate", { url });
      await Promise.race([loaded, new Promise((r) => setTimeout(r, 15000))]);
      await api.settle();
    },
    async settle(ms = 900) { await new Promise((r) => setTimeout(r, ms)); },
    async eval(expression) {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      return result.result.value;
    },
    url: () => api.eval("location.pathname + location.search"),
    text: () => api.eval("document.body.innerText"),
    async fill(selector, value) {
      const ok = await api.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
      if (!ok) throw new Error(`No existe ${selector}`);
    },
    /** Clic en el botón o enlace visible cuyo texto contiene `label` (opcionalmente dentro de `scope`). */
    async click(label, scope = "body", index = 0) {
      const ok = await api.eval(`(() => { const root = document.querySelector(${JSON.stringify(scope)}) ?? document.body; const els = [...root.querySelectorAll('button, a, summary')].filter((el) => el.textContent.trim().includes(${JSON.stringify(label)}) && !el.disabled && el.offsetParent !== null); const el = els[${index}]; if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`);
      if (!ok) throw new Error(`No hay botón «${label}»`);
      await api.settle(1400);
    },
    async shot(file, fullPage = true) {
      let clip;
      if (fullPage) { const m = await send("Page.getLayoutMetrics"); clip = { x: 0, y: 0, width: m.cssContentSize.width, height: Math.min(m.cssContentSize.height, 9000), scale: 1 }; }
      const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: fullPage, ...(clip ? { clip } : {}) });
      writeFileSync(file, Buffer.from(data, "base64"));
    },
    async horizontalOverflow() { return api.eval("document.documentElement.scrollWidth - window.innerWidth"); },
    close() { ws.close(); proc.kill(); },
  };
  return api;
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function totp(secret, at = Date.now(), offset = 0) {
  let bits = ""; for (const c of secret.replace(/\s/g, "")) bits += B32.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000) + offset));
  const mac = createHmac("sha1", key).update(counter).digest();
  const o = mac[19] & 15;
  return String(((mac.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, "0");
}
