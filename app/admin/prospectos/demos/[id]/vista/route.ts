import { requireProspectApi } from "@/lib/prospect/access";
import { idParam } from "@/lib/prospect/api";

type Params = { params: Promise<{ id: string }> };

/** Vista previa interna de cualquier versión de demo (equipo autenticado). */
export async function GET(_request: Request, { params }: Params) {
  const parsed = idParam.safeParse((await params).id);
  if (!parsed.success) return new Response("No encontrado", { status: 404 });
  const ctx = await requireProspectApi("viewer");
  if (ctx instanceof Response) return ctx;
  const demo = await ctx.db.prepare("SELECT html FROM prospect_demos WHERE id = ?").bind(parsed.data).first<{ html: string }>();
  if (!demo) return new Response("No encontrado", { status: 404 });
  const html = demo.html.split('src="img/').join('src="/api/prospect/assets/');
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" } });
}
