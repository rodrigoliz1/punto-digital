/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { TEAM_ROBOTS, teamRoute } from "../lib/deploy/team-mode";
import type { D1Binding, R2Binding } from "../lib/runtime-bindings";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  UPLOADS: R2Bucket;
  /** "team" en el despliegue del subdominio del equipo (ver docs/CLOUDFLARE_DEPLOY.md). */
  DEPLOYMENT_ROLE?: string;
  PUBLIC_SITE_URL?: string;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    globalThis.__PUNTO_DIGITAL_DB__ = env.DB as unknown as D1Binding;
    globalThis.__PUNTO_DIGITAL_UPLOADS__ = env.UPLOADS as unknown as R2Binding;
    globalThis.__PUNTO_DIGITAL_RUNTIME__ = "cloudflare";

    const teamMode = env.DEPLOYMENT_ROLE === "team";
    if (teamMode) {
      const route = teamRoute(url, request.method, env.PUBLIC_SITE_URL || "https://www.ipunto.digital");
      if (route.action === "robots") return new Response(TEAM_ROBOTS, { headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex, nofollow" } });
      if (route.action === "redirect") return new Response(null, { status: route.status, headers: { location: route.location, "cache-control": "no-store" } });
      if (route.action === "not_found") return new Response("No encontrado", { status: 404, headers: { "x-robots-tag": "noindex, nofollow" } });
    }

    if (url.pathname === "/_vinext/image") {
      if (!env.IMAGES) return new Response("Optimización de imágenes no configurada", { status: 404 });
      const images = env.IMAGES;
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await images.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    const headers = new Headers(response.headers);
    headers.set("x-content-type-options", "nosniff");
    headers.set("referrer-policy", "strict-origin-when-cross-origin");
    headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
    headers.set("x-frame-options", "SAMEORIGIN");
    if (url.protocol === "https:") headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
    if (url.pathname.startsWith("/api/") || ["/admin", "/cliente", "/onboarding", "/propuesta"].some((path) => url.pathname.startsWith(path))) headers.set("cache-control", "private, no-store");
    if (teamMode || url.pathname.startsWith("/propuesta") || url.pathname.startsWith("/admin")) headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    headers.set("content-security-policy", `default-src 'self'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://api.stripe.com; frame-src https://checkout.stripe.com; object-src 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'self'; manifest-src 'self'${url.protocol === "https:" ? "; upgrade-insecure-requests" : ""}`);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};

export default worker;
