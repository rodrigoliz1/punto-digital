import { z } from "zod";
import { authEnv, privateSurfacesEnabled, staffFromRequest } from "@/lib/auth/next";
import { AuthError, clearSessionCookies, finishEnrollment, issueCredentialToken, login, logout, readSessionToken, revokeSessions, sessionCookie, startEnrollment } from "@/lib/auth/staff";
import { readJson, requireJsonRequest } from "@/lib/request-security";
import { getD1Binding } from "@/lib/runtime-bindings";

type Params = { params: Promise<{ action: string }> };

const NO_STORE = { "cache-control": "private, no-store" };
const email = z.string().trim().toLowerCase().email().max(160);
const schemas = {
  login: z.object({ email, password: z.string().min(1).max(200), code: z.string().trim().regex(/^\d{6}$/) }).strict(),
  logout: z.object({}).strict(),
  "enroll-start": z.object({ email, token: z.string().min(16).max(200) }).strict(),
  "enroll-finish": z.object({ email, token: z.string().min(16).max(200), password: z.string().min(1).max(200), secret: z.string().regex(/^[A-Z2-7]{32}$/), code: z.string().trim().regex(/^\d{6}$/) }).strict(),
  invite: z.object({ email }).strict(),
  "revoke-sessions": z.object({ email }).strict(),
} as const;

/** IP solo de Cloudflare (no falsificable detrás de su proxy); otras cabeceras se ignoran. */
function clientMeta(request: Request) {
  return { ip: request.headers.get("cf-connecting-ip"), userAgent: request.headers.get("user-agent") };
}

function withCookie(body: unknown, cookie: string | string[]) {
  const headers = new Headers(NO_STORE);
  for (const value of Array.isArray(cookie) ? cookie : [cookie]) headers.append("set-cookie", value);
  return Response.json(body, { headers });
}

export async function POST(request: Request, { params }: Params) {
  const { action } = await params;
  const schema = schemas[action as keyof typeof schemas];
  if (!schema || !privateSurfacesEnabled()) return Response.json({ error: "No encontrado." }, { status: 404, headers: NO_STORE });
  const rejected = requireJsonRequest(request, 10_000);
  if (rejected) return rejected;
  const db = getD1Binding();
  if (!db) return Response.json({ error: "La base de datos no está disponible." }, { status: 503, headers: NO_STORE });
  const env = authEnv();
  const now = new Date();
  try {
    const body = schema.parse((await readJson(request)) ?? {}) as Record<string, string>;
    switch (action) {
      case "login": {
        const session = await login(db, env, { email: body.email, password: body.password, code: body.code }, now, clientMeta(request));
        return withCookie({ ok: true }, sessionCookie(session.token, session.expiresAt, request.url));
      }
      case "logout": {
        await logout(db, readSessionToken(request.headers.get("cookie"), request.url), now);
        return withCookie({ ok: true }, clearSessionCookies(request.url));
      }
      case "enroll-start":
        return Response.json(await startEnrollment(db, env, { email: body.email, token: body.token }, now), { headers: NO_STORE });
      case "enroll-finish": {
        const session = await finishEnrollment(db, env, { email: body.email, token: body.token, password: body.password, secret: body.secret, code: body.code }, now, clientMeta(request));
        return withCookie({ ok: true }, sessionCookie(session.token, session.expiresAt, request.url));
      }
      case "invite":
      case "revoke-sessions": {
        const actor = await staffFromRequest(request);
        if (!actor) return Response.json({ error: "Inicia sesión." }, { status: 401, headers: NO_STORE });
        if (action === "revoke-sessions") return Response.json(await revokeSessions(db, actor, body.email, now, env), { headers: NO_STORE });
        const issued = await issueCredentialToken(db, env, actor, body.email, now);
        const origin = new URL(request.url).origin;
        return Response.json({ url: `${origin}/admin/acceso/activar?email=${encodeURIComponent(body.email)}&token=${issued.token}`, expiresAt: issued.expiresAt, purpose: issued.purpose }, { headers: NO_STORE });
      }
    }
    return Response.json({ error: "No encontrado." }, { status: 404, headers: NO_STORE });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message, code: error.code }, { status: error.status, headers: NO_STORE });
    if (error instanceof z.ZodError) return Response.json({ error: "Datos inválidos.", code: "invalid" }, { status: 400, headers: NO_STORE });
    console.error("auth: error interno", error instanceof Error ? error.name : typeof error);
    return Response.json({ error: "Error interno." }, { status: 500, headers: NO_STORE });
  }
}
