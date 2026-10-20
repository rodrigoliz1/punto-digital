import { z } from "zod";
import { emptyBody, idempotencyKey, idParam, mutation } from "@/lib/prospect/api";
import { activitySchema, briefOptionsSchema, draftSchema, imagesOptionsSchema, prospectSuppressSchema } from "@/lib/prospect/schemas";
import * as service from "@/lib/prospect/service";
import type { Role } from "@/lib/prospect/types";

type Params = { params: Promise<{ id: string; action: string }> };

/** Acciones con captura web o costo potencial: límite por persona más estricto. */
const HEAVY = new Set(["analyze", "brief", "images", "demo", "draft"]);

const ACTIONS: Record<string, { role: Role; schema: z.ZodTypeAny; run: (ctx: service.ProspectContext, id: string, body: never, key: () => string) => Promise<unknown> }> = {
  qualify: { role: "operator", schema: emptyBody, run: (ctx, id) => service.qualify(ctx, id) },
  analyze: { role: "operator", schema: emptyBody, run: (ctx, id, _body, key) => service.analyzeProspectWebsite(ctx, id, key()) },
  brief: { role: "operator", schema: briefOptionsSchema, run: (ctx, id, body: z.infer<typeof briefOptionsSchema>, key) => service.generateBrief(ctx, id, body, key()) },
  images: { role: "operator", schema: imagesOptionsSchema, run: (ctx, id, body: z.infer<typeof imagesOptionsSchema>, key) => service.generateImages(ctx, id, body.count ?? 3, key()) },
  demo: { role: "operator", schema: emptyBody, run: (ctx, id) => service.buildDemo(ctx, id) },
  approve: { role: "reviewer", schema: emptyBody, run: (ctx, id) => service.approveProspect(ctx, id) },
  draft: { role: "operator", schema: draftSchema, run: (ctx, id, body: z.infer<typeof draftSchema>) => service.draftMessage(ctx, id, body) },
  activity: { role: "operator", schema: activitySchema, run: (ctx, id, body: z.infer<typeof activitySchema>) => service.logActivity(ctx, id, body) },
  suppress: { role: "operator", schema: prospectSuppressSchema, run: (ctx, id, body: z.infer<typeof prospectSuppressSchema>) => service.suppressProspect(ctx, id, body.reason) },
};

export async function POST(request: Request, { params }: Params) {
  const { id: rawId, action } = await params;
  const definition = ACTIONS[action];
  if (!definition) return Response.json({ error: "Acción desconocida." }, { status: 404 });
  const parsed = idParam.safeParse(rawId);
  if (!parsed.success) return Response.json({ error: "Identificador inválido." }, { status: 400 });
  return mutation(request, definition.role, definition.schema, (ctx, body) => definition.run(ctx, parsed.data, body as never, () => idempotencyKey(request)), { heavy: HEAVY.has(action) });
}
