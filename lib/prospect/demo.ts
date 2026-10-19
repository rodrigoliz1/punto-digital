import type { BrandBrief } from "./brief";
import { SYNTHETIC_LABEL } from "./brief";

/**
 * Constructor de demos: HTML autocontenido, sin scripts, con todo el texto escapado,
 * `noindex` y avisos visibles de simulación. Nunca se presenta como cuenta oficial del negocio.
 */
export function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const HEX = /^#[0-9a-f]{6}$/i;

function safeColor(value: string | undefined, fallback: string) {
  return value && HEX.test(value) ? value : fallback;
}

/** Texto legible sobre un color de fondo (contraste simple por luminancia). */
export function readableOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#0f172a" : "#ffffff";
}

export type DemoInput = {
  prospect: { name: string; category: string; city: string; zone: string | null };
  brief: BrandBrief;
  /** URLs relativas servidas a través del enlace firmado de la demo. */
  imageUrls: string[];
  generatedAt: string;
};

export function renderDemo({ prospect, brief, imageUrls, generatedAt }: DemoInput) {
  const name = escapeHtml(prospect.name);
  const place = escapeHtml([prospect.zone, prospect.city].filter(Boolean).join(", "));
  const primary = safeColor(brief.palette[0], "#0b1f3a");
  const accent = safeColor(brief.palette[1], "#1769ff");
  const soft = safeColor(brief.palette[2], "#f6f8fc");
  const onPrimary = readableOn(primary);
  const tiles = Array.from({ length: 9 }, (_, index) => {
    const url = imageUrls[index];
    const caption = escapeHtml(brief.contentPillars[index % Math.max(brief.contentPillars.length, 1)] ?? `Concepto ${index + 1}`);
    const media = url && /^[a-zA-Z0-9/_.-]+$/.test(url)
      ? `<img src="${escapeHtml(url)}" alt="Concepto ilustrativo ${index + 1}" loading="lazy">`
      : `<div class="placeholder" aria-hidden="true"></div>`;
    return `<figure>${media}<figcaption><strong>${caption}</strong><span>Concepto ilustrativo</span></figcaption></figure>`;
  }).join("");
  const pillars = brief.contentPillars.map((pillar) => `<li>${escapeHtml(pillar)}</li>`).join("");
  const swatches = brief.palette.filter((color) => HEX.test(color)).map((color) => `<span style="background:${color}" title="${color}"></span>`).join("");
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer">
<title>Propuesta conceptual para ${name} · Punto Digital</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:"Avenir Next","Segoe UI",Arial,sans-serif;background:${soft};color:#0f172a;line-height:1.6}
.notice{position:sticky;top:0;z-index:2;padding:10px 16px;background:#fff7d6;border-bottom:1px solid #ecd98b;font-size:13px;text-align:center}
header{padding:64px 20px 48px;background:${primary};color:${onPrimary}}header>div,main{max-width:960px;margin:0 auto}
header small{letter-spacing:.14em;text-transform:uppercase;opacity:.8;font-size:12px}h1{font-size:clamp(30px,6vw,52px);line-height:1.05;letter-spacing:-.03em;margin:12px 0}
header p{max-width:620px;opacity:.9}main{padding:40px 20px 64px}section{margin-bottom:44px}h2{font-size:24px;margin:0 0 14px;letter-spacing:-.02em}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}figure{margin:0;position:relative;aspect-ratio:1;overflow:hidden;border-radius:12px;background:${accent}}
figure img,.placeholder{width:100%;height:100%;object-fit:cover;display:block}.placeholder{background:linear-gradient(145deg,${primary},${accent} 60%,${soft})}
figcaption{position:absolute;inset:auto 0 0 0;padding:10px;background:linear-gradient(transparent,rgb(0 0 0 / 70%));color:#fff;font-size:12px;display:flex;flex-direction:column}
figcaption span{font-size:10px;opacity:.85}.swatches{display:flex;gap:8px}.swatches span{width:44px;height:44px;border-radius:10px;border:1px solid rgb(0 0 0 / 10%)}
.card{background:#fff;border-radius:16px;padding:22px;border:1px solid rgb(15 23 42 / 8%)}ul{padding-left:20px;margin:0}
footer{max-width:960px;margin:0 auto;padding:0 20px 48px;font-size:12px;color:#475569}
@media (max-width:560px){.grid{gap:6px}figcaption{padding:6px;font-size:10px}figcaption span{display:none}}
</style></head>
<body>
<div class="notice" role="note">Simulación conceptual preparada por Punto Digital. No está afiliada a ${name} ni representa publicaciones, productos o instalaciones reales.</div>
<header><div><small>Punto Digital · Propuesta conceptual</small><h1>Así podría verse la comunicación digital de ${name}.</h1><p>${escapeHtml(brief.positioning)}</p><p>${place}</p></div></header>
<main>
<section><h2>Dirección visual</h2><div class="card"><p>${escapeHtml(brief.visualDirection)}</p><div class="swatches" aria-label="Paleta propuesta">${swatches}</div><p><small>Paleta y estilo propuestos; sujetos a validación con el negocio.</small></p></div></section>
<section><h2>Nueve piezas de ejemplo</h2><div class="grid">${tiles}</div><p><small>${escapeHtml(SYNTHETIC_LABEL)}</small></p></section>
<section><h2>Pilares de contenido</h2><div class="card"><ul>${pillars}</ul><p><strong>Tono:</strong> ${escapeHtml(brief.voice)}</p></div></section>
<section><h2>Siguiente paso</h2><div class="card"><p>Si te interesa conversar sobre esta propuesta, responde al mensaje en el que recibiste este enlace. Si prefieres no recibir más mensajes, indícalo en tu respuesta y no volveremos a contactarte.</p></div></section>
</main>
<footer>Documento privado generado el ${escapeHtml(generatedAt.slice(0, 10))}. Ningún contenido está aprobado para publicación. No se utilizaron fotografías ni logotipos del negocio.</footer>
</body></html>`;
}
