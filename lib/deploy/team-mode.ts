/**
 * Modo «equipo»: el Worker desplegado en Cloudflare para el subdominio del equipo solo sirve el
 * panel, la API privada, el acceso y las demos. Las páginas públicas redirigen a www.ipunto.digital
 * (que sigue en Vercel) para no duplicar el sitio ni su indexación.
 * Los archivos estáticos los sirve Cloudflare antes de llegar al Worker.
 */
export const TEAM_ALLOWED_PREFIXES = ["/admin", "/api/auth", "/api/prospect", "/propuesta", "/_vinext"] as const;

/** Coincidencia por segmento completo: /admin, /admin/…, /admin.rsc; nunca /administracion. */
function underPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}.`);
}

export type TeamRoute = { action: "pass" } | { action: "redirect"; location: string; status: 302 | 308 } | { action: "robots" } | { action: "not_found" };

export function teamRoute(url: URL, method: string, publicSiteUrl: string): TeamRoute {
  const path = url.pathname;
  if (path === "/robots.txt") return { action: "robots" };
  if (path === "/" || path === "/index.rsc") return { action: "redirect", location: "/admin", status: 302 };
  if (TEAM_ALLOWED_PREFIXES.some((prefix) => underPrefix(path, prefix))) return { action: "pass" };
  // Las APIs públicas (formularios, pagos) solo existen en el sitio público.
  if (path.startsWith("/api/") || !["GET", "HEAD"].includes(method)) return { action: "not_found" };
  const target = new URL(path + url.search, publicSiteUrl);
  return { action: "redirect", location: target.toString(), status: 308 };
}

export const TEAM_ROBOTS = "User-agent: *\nDisallow: /\n";
