import type { z } from "zod";
import { emptyBody, idParam, mutation } from "@/lib/prospect/api";
import { messagePatchSchema } from "@/lib/prospect/schemas";
import * as service from "@/lib/prospect/service";
import type { Role } from "@/lib/prospect/types";

type Params = { params: Promise<{ id: string; action: string }> };

const ACTIONS: Record<string, { role: Role; schema: z.ZodTypeAny; run: (ctx: service.ProspectContext, id: string, body: never) => Promise<unknown> }> = {
  edit: { role: "operator", schema: messagePatchSchema, run: (ctx, id, body: z.infer<typeof messagePatchSchema>) => service.updateMessage(ctx, id, body) },
  approve: { role: "reviewer", schema: emptyBody, run: (ctx, id) => service.approveMessage(ctx, id) },
  prepare: { role: "reviewer", schema: emptyBody, run: (ctx, id) => service.prepareMessageForSending(ctx, id) },
  sent: { role: "reviewer", schema: emptyBody, run: (ctx, id) => service.markMessageSent(ctx, id) },
  discard: { role: "operator", schema: emptyBody, run: (ctx, id) => service.discardMessage(ctx, id) },
};

export async function POST(request: Request, { params }: Params) {
  const { id: rawId, action } = await params;
  const definition = ACTIONS[action];
  const parsed = idParam.safeParse(rawId);
  if (!definition || !parsed.success) return Response.json({ error: "No encontrado." }, { status: 404 });
  return mutation(request, definition.role, definition.schema, (ctx, body) => definition.run(ctx, parsed.data, body as never));
}
