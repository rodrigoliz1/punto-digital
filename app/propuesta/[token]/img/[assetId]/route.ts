import { prospectOsEnabled } from "@/lib/prospect/access";
import { parseJson, resolveDemoByToken } from "@/lib/prospect/service";
import { getD1Binding, getR2Binding } from "@/lib/runtime-bindings";

type Params = { params: Promise<{ token: string; assetId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token, assetId } = await params;
  const db = getD1Binding();
  const r2 = getR2Binding();
  if (!prospectOsEnabled() || !db || !r2) return new Response("No encontrado", { status: 404 });
  const demo = await resolveDemoByToken(db, token, new Date());
  if (!demo || !parseJson<string[]>(demo.assets, []).includes(assetId)) return new Response("No encontrado", { status: 404 });
  const asset = await db.prepare("SELECT storage_key, mime_type FROM prospect_assets WHERE id = ? AND status = 'approved'").bind(assetId).first<{ storage_key: string; mime_type: string }>();
  const object = asset ? await r2.get(asset.storage_key) : null;
  if (!asset || !object) return new Response("No encontrado", { status: 404 });
  return new Response(object.body, { headers: { "content-type": asset.mime_type, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "x-robots-tag": "noindex" } });
}
