import { getD1Binding, type D1Binding } from "@/lib/runtime-bindings";

/**
 * Límites de solicitudes por ventana fija.
 * - Con D1 (Cloudflare): contador compartido entre instancias, en `request_rate_limits`.
 * - Sin D1 (Vercel): contador en memoria por instancia; es una defensa parcial y debe
 *   complementarse con una regla de firewall de la plataforma (ver docs/CLOUDFLARE_DEPLOY.md).
 * La IP solo se toma de encabezados que la plataforma fija y el cliente no controla, y se guarda como hash.
 */

export type RateLimitPolicy = { id: string; limit: number; windowSeconds: number };

export const RATE_LIMITS = {
  publicFormMinute: { id: "form_m", limit: 5, windowSeconds: 60 },
  publicFormHour: { id: "form_h", limit: 30, windowSeconds: 3600 },
  transferEmail: { id: "transfer", limit: 3, windowSeconds: 600 },
  checkout: { id: "checkout", limit: 10, windowSeconds: 60 },
  auth: { id: "auth", limit: 20, windowSeconds: 60 },
  prospectApiIp: { id: "papi_ip", limit: 300, windowSeconds: 60 },
  prospectApiUser: { id: "papi_user", limit: 120, windowSeconds: 60 },
  prospectAgent: { id: "agent", limit: 20, windowSeconds: 60 },
  demoIp: { id: "demo_ip", limit: 60, windowSeconds: 60 },
  demoToken: { id: "demo_tok", limit: 120, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitResult = { allowed: boolean; count: number; retryAfter: number };

export interface RateLimitStore {
  hit(key: string, windowStart: number, expiresAt: number): Promise<number>;
}

export function d1RateLimitStore(db: D1Binding): RateLimitStore {
  return {
    async hit(key, windowStart, expiresAt) {
      const row = await db.prepare(`INSERT INTO request_rate_limits (key, window_start, count, expires_at) VALUES (?, ?, 1, ?)
        ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END, window_start = excluded.window_start, expires_at = excluded.expires_at
        RETURNING count`).bind(key, windowStart, expiresAt).first<{ count: number }>();
      // Limpieza ocasional de ventanas vencidas.
      if (Math.random() < 0.01) await db.prepare("DELETE FROM request_rate_limits WHERE expires_at < ?").bind(windowStart).run();
      return row?.count ?? 1;
    },
  };
}

const MEMORY_MAX_KEYS = 10_000;
const memory = new Map<string, { windowStart: number; count: number; expiresAt: number }>();

export const memoryRateLimitStore: RateLimitStore = {
  async hit(key, windowStart, expiresAt) {
    const current = memory.get(key);
    const count = current && current.windowStart === windowStart ? current.count + 1 : 1;
    if (!current && memory.size >= MEMORY_MAX_KEYS) {
      const now = windowStart;
      for (const [k, v] of memory) if (v.expiresAt < now) memory.delete(k);
      if (memory.size >= MEMORY_MAX_KEYS) memory.delete(memory.keys().next().value as string);
    }
    memory.set(key, { windowStart, count, expiresAt });
    return count;
  },
};

export function resetMemoryRateLimits() {
  memory.clear();
}

export async function checkRateLimit(store: RateLimitStore, policy: RateLimitPolicy, subject: string, now: Date): Promise<RateLimitResult> {
  const seconds = Math.floor(now.getTime() / 1000);
  const windowStart = seconds - (seconds % policy.windowSeconds);
  const count = await store.hit(`${policy.id}:${subject}`, windowStart, windowStart + policy.windowSeconds);
  return { allowed: count <= policy.limit, count, retryAfter: windowStart + policy.windowSeconds - seconds };
}

declare global {
  var __PUNTO_DIGITAL_RUNTIME__: "cloudflare" | undefined;
}

/**
 * IP del cliente solo desde la cabecera que fija la plataforma: en Cloudflare `cf-connecting-ip`
 * (el Worker marca el runtime), en Vercel `x-real-ip`. Fuera de ellas (desarrollo local) no hay IP confiable.
 */
export function trustedClientIp(request: Request) {
  if (globalThis.__PUNTO_DIGITAL_RUNTIME__ === "cloudflare") return request.headers.get("cf-connecting-ip");
  if (process.env.VERCEL) return request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return null;
}

async function hashSubject(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`rate-limit:${process.env.AUTH_SECRET ?? ""}:${value}`));
  return [...new Uint8Array(digest).slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ipSubject(request: Request) {
  const ip = trustedClientIp(request);
  return ip ? `ip:${await hashSubject(ip)}` : "ip:local";
}

export async function userSubject(email: string) {
  return `user:${await hashSubject(email.toLowerCase())}`;
}

function activeStore(): RateLimitStore {
  const db = getD1Binding();
  return db ? d1RateLimitStore(db) : memoryRateLimitStore;
}

export function tooManyRequests(retryAfter: number, html = false) {
  const headers = { "retry-after": String(Math.max(1, retryAfter)), "cache-control": "private, no-store" };
  if (html) return new Response("<!doctype html><meta charset=utf-8><meta name=robots content=noindex><title>Demasiadas solicitudes</title><p style=\"font-family:system-ui;margin:80px auto;max-width:520px\">Demasiadas solicitudes. Intenta de nuevo en unos minutos.</p>", { status: 429, headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
  return Response.json({ error: "Demasiadas solicitudes. Intenta de nuevo en unos minutos.", code: "rate_limited" }, { status: 429, headers });
}

/**
 * Aplica varias políticas; devuelve una respuesta 429 si alguna se excede, o null.
 * Si el almacén falla, se permite la solicitud (disponibilidad) y se registra el tipo de error.
 */
export async function enforceRateLimits(checks: Array<{ policy: RateLimitPolicy; subject: string }>, options: { html?: boolean; now?: Date; store?: RateLimitStore } = {}) {
  const store = options.store ?? activeStore();
  const now = options.now ?? new Date();
  for (const { policy, subject } of checks) {
    let result: RateLimitResult;
    try {
      result = await checkRateLimit(store, policy, subject, now);
    } catch (error) {
      console.error("rate-limit: almacén no disponible", error instanceof Error ? error.name : typeof error);
      result = await checkRateLimit(memoryRateLimitStore, policy, subject, now);
    }
    if (!result.allowed) return tooManyRequests(result.retryAfter, options.html);
  }
  return null;
}

/** Atajo para endpoints públicos limitados por IP. */
export async function limitByIp(request: Request, policies: RateLimitPolicy[], options: { html?: boolean } = {}) {
  const subject = await ipSubject(request);
  return enforceRateLimits(policies.map((policy) => ({ policy, subject })), options);
}
