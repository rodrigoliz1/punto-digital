import { prospectOsEnabled } from "@/lib/prospect/access";
import { recordDemoView, resolveDemoByToken } from "@/lib/prospect/service";
import { getD1Binding } from "@/lib/runtime-bindings";

type Params = { params: Promise<{ token: string }> };

const DEMO_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex, nofollow, noarchive",
  "referrer-policy": "no-referrer",
};

const NOT_AVAILABLE = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Propuesta no disponible</title></head><body style="font-family:system-ui;max-width:560px;margin:80px auto;padding:0 20px;color:#0f172a"><h1>Esta propuesta no está disponible.</h1><p>El enlace venció o fue retirado. Si necesitas verla, responde al mensaje de Punto Digital.</p></body></html>`;

/** Demo privada por enlace con expiración. Solo demos aprobadas por una persona. */
export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  const db = getD1Binding();
  if (!prospectOsEnabled() || !db) return new Response(NOT_AVAILABLE, { status: 404, headers: DEMO_HEADERS });
  const now = new Date();
  const demo = await resolveDemoByToken(db, token, now);
  if (!demo) return new Response(NOT_AVAILABLE, { status: 404, headers: DEMO_HEADERS });
  await recordDemoView(db, demo.id, now);
  const html = demo.html.split('src="img/').join(`src="/propuesta/${token}/img/`);
  return new Response(html, { headers: DEMO_HEADERS });
}
