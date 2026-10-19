import { z } from "zod";
import { readJson, requireJsonRequest } from "@/lib/request-security";
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

/** Mutaciones: JSON estricto, mismo origen (CSRF), sesión, rol mínimo y validación con Zod. */
export async function mutation<S extends z.ZodTypeAny>(request: Request, minimum: Role, schema: S, handler: Handler<z.infer<S>>) {
  const rejected = requireJsonRequest(request, 200_000);
  if (rejected) return rejected;
  const ctx = await requireProspectApi(minimum);
  if (ctx instanceof Response) return ctx;
  try {
    const body = schema.parse((await readJson(request)) ?? {});
    return Response.json(await handler(ctx, body), { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function query(minimum: Role, handler: (ctx: ProspectContext) => Promise<unknown>) {
  const ctx = await requireProspectApi(minimum);
  if (ctx instanceof Response) return ctx;
  try {
    return Response.json(await handler(ctx), { headers: NO_STORE });
  } catch (error) {
    return errorResponse(error);
  }
}

export const emptyBody = z.object({}).strict();
export const idParam = z.string().regex(/^[a-z]{3}_[0-9a-f]{32}$/);
