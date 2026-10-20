import { emptyBody, idParam, mutation } from "@/lib/prospect/api";
import { issueDemoLink, revokeDemo } from "@/lib/prospect/service";

type Params = { params: Promise<{ id: string; action: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: rawId, action } = await params;
  const parsed = idParam.safeParse(rawId);
  if (!parsed.success || !["link", "revoke"].includes(action)) return Response.json({ error: "No encontrado." }, { status: 404 });
  return mutation(request, "reviewer", emptyBody, (ctx) => (action === "link" ? issueDemoLink(ctx, parsed.data) : revokeDemo(ctx, parsed.data)));
}
