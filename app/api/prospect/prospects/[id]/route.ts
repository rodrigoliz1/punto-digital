import { idParam, mutation, query } from "@/lib/prospect/api";
import { getProspectDetail } from "@/lib/prospect/queries";
import { prospectPatchSchema } from "@/lib/prospect/schemas";
import { updateProspect } from "@/lib/prospect/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const parsed = idParam.safeParse((await params).id);
  if (!parsed.success) return Response.json({ error: "No encontrado." }, { status: 404 });
  const id = parsed.data;
  return query(request, "viewer", (ctx) => getProspectDetail(ctx.db, id));
}

export async function PATCH(request: Request, { params }: Params) {
  const parsed = idParam.safeParse((await params).id);
  if (!parsed.success) return Response.json({ error: "No encontrado." }, { status: 404 });
  const id = parsed.data;
  return mutation(request, "operator", prospectPatchSchema, (ctx, body) => updateProspect(ctx, id, body));
}
