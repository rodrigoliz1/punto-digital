import { idParam, mutation, query } from "@/lib/prospect/api";
import { getProspectDetail } from "@/lib/prospect/queries";
import { prospectPatchSchema } from "@/lib/prospect/schemas";
import { updateProspect } from "@/lib/prospect/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const id = idParam.parse((await params).id);
  return query("viewer", (ctx) => getProspectDetail(ctx.db, id));
}

export async function PATCH(request: Request, { params }: Params) {
  const id = idParam.parse((await params).id);
  return mutation(request, "operator", prospectPatchSchema, (ctx, body) => updateProspect(ctx, id, body));
}
