const JSON_CONTENT_TYPE = "application/json";

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function requireJsonRequest(request: Request, maxBytes = 50_000): Response | null {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== JSON_CONTENT_TYPE) return jsonError("El contenido de la solicitud no es válido.", 415);

  const length = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(length) || length < 0 || length > maxBytes) return jsonError("Solicitud demasiado grande.", 413);

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return jsonError("Origen de solicitud no permitido.", 403);
  return null;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function configuredSiteOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return url.origin;
    } catch {
      // Use the request origin when configuration is malformed.
    }
  }
  return new URL(request.url).origin;
}
