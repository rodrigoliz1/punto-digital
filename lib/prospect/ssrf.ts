import { ProspectError } from "./types";

/**
 * Captura web defensiva para el analista de marca.
 * - Solo http(s), puertos estándar, sin credenciales.
 * - Rechaza IPs privadas, reservadas, loopback, link-local y metadata cloud, también tras resolver DNS (DoH).
 * - Redirecciones manuales (máx. 3) revalidando cada salto; tiempo, tamaño y tipo MIME limitados.
 * En Cloudflare Workers la salida no alcanza redes privadas; la validación protege además el build de Vercel/Node.
 */

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal", "metadata", "instance-data", "kubernetes.default"]);
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp", ".intranet", ".localdomain"];

function ipv4ToInt(ip: string) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

const PRIVATE_V4: Array<[string, number]> = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

export function isPrivateIPv4(ip: string) {
  const value = ipv4ToInt(ip);
  if (value === null) return false;
  return PRIVATE_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return ((value & mask) >>> 0) === ((ipv4ToInt(base)! & mask) >>> 0);
  });
}

export function isPrivateIPv6(raw: string) {
  const ip = raw.replace(/^\[|\]$/g, "").toLowerCase();
  if (!ip.includes(":")) return false;
  if (ip === "::" || ip === "::1") return true;
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(ip)) return true; // IPv4 mapeada en hex: se rechaza por prudencia
  return /^(fc|fd|fe8|fe9|fea|feb|ff|2001:db8|64:ff9b|100::)/.test(ip);
}

export function isIpLiteral(hostname: string) {
  return ipv4ToInt(hostname) !== null || hostname.includes(":") || /^\[.*\]$/.test(hostname);
}

/** Validación sintáctica (sin DNS). Lanza ProspectError si la URL no es apta para captura. */
export function assertPublicHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ProspectError("URL inválida.", 422, "invalid_url");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new ProspectError("Solo se permiten URLs http(s).", 422, "invalid_url");
  if (url.username || url.password) throw new ProspectError("La URL no puede incluir credenciales.", 422, "invalid_url");
  if (url.port && !["80", "443"].includes(url.port)) throw new ProspectError("Puerto no permitido.", 422, "invalid_url");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") && !isIpLiteral(host)) throw new ProspectError("Host no permitido.", 422, "blocked_host");
  if (BLOCKED_HOSTNAMES.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) throw new ProspectError("Host no permitido.", 422, "blocked_host");
  // Formas numéricas alternativas (decimal, octal, hex) que algunos resolvers aceptan.
  if (/^(0x[0-9a-f]+|\d+)$/i.test(host) || /^[0-9.]+$/.test(host) && ipv4ToInt(host) === null) throw new ProspectError("Host no permitido.", 422, "blocked_host");
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) throw new ProspectError("Dirección privada o reservada.", 422, "blocked_host");
  return url;
}

type Resolver = (hostname: string) => Promise<string[]>;

/** Resolución vía DNS-over-HTTPS (disponible en Workers y Node). */
export const dohResolver: Resolver = async (hostname) => {
  const answers: string[] = [];
  for (const type of ["A", "AAAA"]) {
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(4000) });
    if (!response.ok) continue;
    const data = (await response.json()) as { Answer?: Array<{ type: number; data: string }> };
    for (const answer of data.Answer ?? []) if (answer.type === 1 || answer.type === 28) answers.push(answer.data);
  }
  return answers;
};

export type SafeFetchOptions = { maxBytes?: number; timeoutMs?: number; maxRedirects?: number; resolver?: Resolver; fetchImpl?: typeof fetch; allowedTypes?: string[] };
export type SafeFetchResult = { finalUrl: string; status: number; contentType: string; body: string; truncated: boolean };

export async function safeFetchText(input: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const { maxBytes = 1_500_000, timeoutMs = 8000, maxRedirects = 3, resolver = dohResolver, fetchImpl = fetch, allowedTypes = ["text/html", "application/xhtml+xml"] } = options;
  let current = assertPublicHttpUrl(input);
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    if (!isIpLiteral(current.hostname)) {
      const addresses = await resolver(current.hostname);
      if (addresses.length === 0) throw new ProspectError("No se pudo resolver el dominio.", 422, "dns_failed");
      if (addresses.some((ip) => isPrivateIPv4(ip) || isPrivateIPv6(ip))) throw new ProspectError("El dominio resuelve a una dirección privada.", 422, "blocked_host");
    }
    const response = await fetchImpl(current.toString(), { redirect: "manual", headers: { "user-agent": "PuntoDigitalProspectOS/0.1 (+https://www.ipunto.digital)", accept: "text/html" }, signal: AbortSignal.timeout(timeoutMs) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new ProspectError("Redirección sin destino.", 422, "bad_redirect");
      current = assertPublicHttpUrl(new URL(location, current).toString());
      continue;
    }
    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!allowedTypes.includes(contentType)) throw new ProspectError(`Tipo de contenido no permitido: ${contentType || "desconocido"}.`, 422, "bad_content_type");
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > maxBytes * 4) throw new ProspectError("Respuesta demasiado grande.", 422, "too_large");
    const { text, truncated } = await readLimited(response, maxBytes);
    return { finalUrl: current.toString(), status: response.status, contentType, body: text, truncated };
  }
  throw new ProspectError("Demasiadas redirecciones.", 422, "too_many_redirects");
}

async function readLimited(response: Response, maxBytes: number) {
  if (!response.body) return { text: "", truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.byteLength > maxBytes) {
      chunks.push(value.slice(0, maxBytes - size));
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  const merged = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(merged), truncated };
}
