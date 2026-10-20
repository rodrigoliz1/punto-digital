import { z } from "zod";
import { readJson, requireJsonRequest } from "@/lib/request-security";
import { enforceRateLimits, ipSubject, RATE_LIMITS, userSubject } from "@/lib/security/rate-limit";
import { requireProspectApi } from "./access";
import type { ProspectContext } from "./service";
import { ProspectError, type Role } from "./types";

const NO_STORE = { "cache-control": "private, no-store" };

export function errorResponse(error: unknown) {
  if (error instanceof ProspectError) return Response.json({ error: error.message, code: error.code }, { status: error.status, headers: NO_STORE });
  if (error instanceof z.ZodError) return Response.json({ error: "Datos inválidos.", code: "invalid", details: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) }, { status: 400, headers: NO_STORE });
  // Nunca se registran cuerpos ni credenciales; solo el tipo de error.
  console.error("prospect-os: error interno", error instanceof Error ? error.name : typeof error);
  return Response.json({ error: "Error interno." }, { status: 500, headers: NO_STORE });
}

/** Clave de idempotencia por clic (UUID enviado por el panel). */
export function idempotencyKey(request: Request) {
  const key = request.headers.get("idempotency-key") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw new ProspectError("Falta la clave de idempotencia.", 400, "missing_idempotency_key");
  return key;
}

type Handler<T> = (ctx: ProspectContext, body: T) => Promise<unknown>;

/** Límite por IP antes de autenticar (frena ataques sin sesión). */
export async function limitProspectIp(request: Request) {
  return enforceRateLimits([{ policy: RATE_LIMITS.prospectApiIp, subject: await ipSubject(request) }]);
}

/** Límite por persona tras autenticar; las acciones de agentes (con costo o captura web) tienen uno más estricto. */
async function limitProspectUser(ctx: ProspectContext, heavy: boolean) {
  const subject = await userSubject(ctx.actor.email);
  return enforceRateLimits([{ policy: RATE_LIMITS.prospectApiUser, subject }, ...(heavy ? [{ policy: RATE_LIMITS.prospectAgent, subject }] : [])]);
}

/** Mutaciones: límite de solicitudes, JSON estricto, mismo origen (CSRF), sesión, rol mínimo y validación con Zod. */
export async function mutation<S extends z.ZodTypeAny>(request: Request, minimum: Role, schema: S, handler: Handler<z.infer<S>>, options: { heavy?: boolean } = {}) {
  const limitedIp = await limitProspectIp(request);
  if (limitedIp) return limitedIp;
  const rejected = requireJsonRequest(request, 200_000);
  if (rejected) return rejected;
  const ctx = await requireProspectApi(request, minimum);
  if (ctx instanceof Response) return ctx;
  const limitedUser = await limitProspectUser(ctx, options.heavy ?? false);
  if (limitedUser) return limitedUser;
  try {
    const body = schema.parse((await readJson(request)) ?? {});
    return Response.json(await handler(ctx, body), { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function query(request: Request, minimum: Role, handler: (ctx: ProspectContext) => Promise<unknown>) {
  const limitedIp = await limitProspectIp(request);
  if (limitedIp) return limitedIp;
  const ctx = await requireProspectApi(request, minimum);
  if (ctx instanceof Response) return ctx;
  try {
    return Response.json(await handler(ctx), { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error);
  }
}

export const emptyBody = z.object({}).strict();
export const idParam = z.string().regex(/^[a-z]{3}_[0-9a-f]{32}$/);
