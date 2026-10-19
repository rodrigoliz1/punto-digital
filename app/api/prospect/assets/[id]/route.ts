import { requireProspectApi } from "@/lib/prospect/access";
import { idParam } from "@/lib/prospect/api";

type Params = { params: Promise<{ id: string }> };

/** Vista interna de imágenes generadas (solo equipo autenticado). */
export async function GET(request: Request, { params }: Params) {
  const parsed = idParam.safeParse((await params).id);
  if (!parsed.success) return new Response("No encontrado", { status: 404 });
  const ctx = await requireProspectApi(request, "viewer");
  if (ctx instanceof Response) return ctx;
  const asset = await ctx.db.prepare("SELECT storage_key, mime_type FROM prospect_assets WHERE id = ?").bind(parsed.data).first<{ storage_key: string; mime_type: string }>();
  const object = asset && ctx.r2 ? await ctx.r2.get(asset.storage_key) : null;
  if (!asset || !object) return new Response("No encontrado", { status: 404 });
  return new Response(object.body, { headers: { "content-type": asset.mime_type, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
