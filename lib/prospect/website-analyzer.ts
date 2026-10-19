import { emailDomain, isPersonalEmailDomain, normalizeEmail, parseHttpUrl, registrableDomain } from "./normalize";

/**
 * Extrae señales de identidad de un HTML público. El contenido es dato no confiable:
 * no se ejecuta, no se siguen instrucciones embebidas y solo se conservan campos acotados.
 */
export type WebsiteAnalysis = {
  url: string;
  https: boolean;
  title: string | null;
  description: string | null;
  siteName: string | null;
  lang: string | null;
  themeColor: string | null;
  ogImageUrl: string | null;
  hasViewport: boolean;
  generator: string | null;
  palette: string[];
  social: { instagram: string | null; facebook: string | null; tiktok: string | null; whatsapp: boolean };
  businessEmails: string[];
  imageCount: number;
  keywords: string[];
  issues: string[];
  suggestedPresenceGap: number;
};

const MAX_FIELD = 300;

function clean(value: string | null | undefined, max = MAX_FIELD) {
  if (!value) return null;
  const text = decodeEntities(value).replace(/<[^>]*>/g, " ").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

function decodeEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code) % 0x110000))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16) % 0x110000))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

function metaContent(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return clean(match[1]);
  }
  return null;
}

function absoluteUrl(value: string | null, base: string) {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return ["http:", "https:"].includes(url.protocol) ? url.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}

function socialProfile(links: string[], host: RegExp, reserved: string[]) {
  for (const link of links) {
    const url = parseHttpUrl(link);
    if (!url || !host.test(url.hostname)) continue;
    const first = url.pathname.split("/").filter(Boolean)[0];
    if (first && !reserved.includes(first.toLowerCase())) return `https://${url.hostname.replace(/^m\./, "www.")}/${first}`;
  }
  return null;
}

export function extractPalette(html: string, limit = 6) {
  const counts = new Map<string, number>();
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join(" ") + " " + [...html.matchAll(/style=["']([^"']*)["']/gi)].map((m) => m[1]).join(" ");
  for (const match of styles.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    let hex = match[1].toLowerCase();
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    if (["ffffff", "000000"].includes(hex)) continue;
    counts.set(`#${hex}`, (counts.get(`#${hex}`) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([hex]) => hex);
}

const KEYWORDS: Array<[string, RegExp]> = [
  ["reservaciones", /reserv/i], ["menú", /\bmen[uú](?![a-z])/i], ["tienda en línea", /carrito|add to cart|agregar al carrito|checkout/i],
  ["citas", /agenda|cita|appointment/i], ["pedidos a domicilio", /domicilio|delivery|rappi|uber ?eats|didi ?food/i], ["blog", /\bblog\b/i],
];

export function analyzeWebsite(html: string, pageUrl: string): WebsiteAnalysis {
  const url = new URL(pageUrl);
  const head = html.slice(0, 200_000);
  const links = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => decodeEntities(m[1]));
  const siteDomain = registrableDomain(pageUrl) ?? "";
  const emails = new Set<string>();
  for (const link of links) {
    if (!link.toLowerCase().startsWith("mailto:")) continue;
    const email = normalizeEmail(link.slice(7).split("?")[0]);
    // Solo correos del dominio del negocio; nunca correos personales.
    const domain = email ? emailDomain(email) : "";
    if (email && siteDomain && !isPersonalEmailDomain(email) && (domain === siteDomain || domain.endsWith(`.${siteDomain}`))) emails.add(email);
  }
  const text = clean(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " "), 50_000) ?? "";
  const analysis: WebsiteAnalysis = {
    url: url.toString(),
    https: url.protocol === "https:",
    title: clean(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 160),
    description: metaContent(head, "description") ?? metaContent(head, "og:description"),
    siteName: metaContent(head, "og:site_name"),
    lang: clean(head.match(/<html[^>]*\slang=["']([^"']+)["']/i)?.[1], 12),
    themeColor: metaContent(head, "theme-color"),
    ogImageUrl: absoluteUrl(metaContent(head, "og:image"), url.toString()),
    hasViewport: /<meta[^>]+name=["']viewport["']/i.test(head),
    generator: metaContent(head, "generator"),
    palette: extractPalette(html),
    social: {
      instagram: socialProfile(links, /(^|\.)instagram\.com$/i, ["p", "reel", "explore", "stories", "accounts"]),
      facebook: socialProfile(links, /(^|\.)facebook\.com$/i, ["sharer", "sharer.php", "share", "dialog", "plugins", "tr"]),
      tiktok: socialProfile(links, /(^|\.)tiktok\.com$/i, ["embed", "share"]),
      whatsapp: links.some((link) => /wa\.me\/|api\.whatsapp\.com/i.test(link)),
    },
    businessEmails: [...emails].slice(0, 5),
    imageCount: (html.match(/<img\b/gi) ?? []).length,
    keywords: KEYWORDS.filter(([, pattern]) => pattern.test(text)).map(([label]) => label),
    issues: [],
    suggestedPresenceGap: 0,
  };
  if (!analysis.https) analysis.issues.push("El sitio no usa HTTPS.");
  if (!analysis.hasViewport) analysis.issues.push("No declara viewport móvil.");
  if (!analysis.title) analysis.issues.push("Sin título de página.");
  if (!analysis.description) analysis.issues.push("Sin meta descripción.");
  if (analysis.imageCount < 3) analysis.issues.push("Pocas imágenes en la página principal.");
  if (!analysis.social.instagram && !analysis.social.facebook) analysis.issues.push("No enlaza redes sociales.");
  analysis.suggestedPresenceGap = Math.min(5, analysis.issues.length);
  return analysis;
}

/** Brecha sugerida cuando el negocio no tiene sitio web propio. */
export const NO_WEBSITE_PRESENCE_GAP = 5;
