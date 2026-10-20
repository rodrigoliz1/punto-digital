import Link from "next/link";
import { Badge, Empty, PageHeader, Panel, ScoreBar, Table, date } from "@/components/prospect/ui";
import { requireProspectPage } from "@/lib/prospect/access";
import { listFacets, listProspects } from "@/lib/prospect/queries";
import { listFiltersSchema } from "@/lib/prospect/schemas";
import { parseJson } from "@/lib/prospect/service";
import { PROSPECT_STATUSES, STATUS_LABELS } from "@/lib/prospect/types";

export const metadata = { title: "Prospectos" };

export default async function ProspectListPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireProspectPage("/admin/prospectos/lista");
  const raw = await searchParams;
  const parsed = listFiltersSchema.safeParse(Object.fromEntries(Object.entries(raw).filter(([, value]) => value)));
  const filters = parsed.success ? parsed.data : listFiltersSchema.parse({});
  const [rows, facets] = await Promise.all([listProspects(ctx.db, filters), listFacets(ctx.db)]);
  return (
    <>
      <PageHeader eyebrow="CRM" title="Prospectos y calificación" description="Ordenados por puntaje. La evidencia faltante suma cero y se muestra como pendiente; no equivale a bajo rendimiento." actions={<Link href="/admin/prospectos/descubrir" className="po-btn po-btn--primary">Agregar</Link>} />
      <form className="po-filters" method="get">
        <label>Buscar<input name="q" defaultValue={filters.q} placeholder="Nombre o zona" /></label>
        <label>Estado<select name="status" defaultValue={filters.status ?? ""}><option value="">Todos</option>{PROSPECT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></label>
        <label>Ciudad<select name="city" defaultValue={filters.city ?? ""}><option value="">Todas</option>{facets.cities.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Giro<select name="category" defaultValue={filters.category ?? ""}><option value="">Todos</option>{facets.categories.map((c) => <option key={c}>{c}</option>)}</select></label>
        <button className="po-btn po-btn--secondary" type="submit">Filtrar</button>
      </form>
      <Panel title={`${rows.length} prospecto${rows.length === 1 ? "" : "s"}`}>
        {rows.length === 0 ? <Empty title="Sin resultados">Ajusta los filtros o agrega prospectos.</Empty> : (
          <Table head={["Negocio", "Estado", "Puntaje", "Contacto público", "Evidencia faltante", "Actualizado"]}>
            {rows.map((row) => {
              const missing = parseJson<string[]>(row.missing_evidence, []);
              return (
                <tr key={row.id}>
                  <td><Link className="po-row-link" href={`/admin/prospectos/p/${row.id}`}>{row.name}</Link><small>{row.category} · {[row.zone, row.city].filter(Boolean).join(", ")}</small></td>
                  <td><Badge status={row.status} /></td>
                  <td><ScoreBar score={row.score} /></td>
                  <td><small>{[row.email_public && "correo", row.phone_public && "teléfono", row.instagram_url && "Instagram", row.website && "sitio"].filter(Boolean).join(" · ") || "—"}</small></td>
                  <td><small>{missing.length ? `${missing.length} señal(es)` : "Completa"}</small></td>
                  <td><small>{date(row.updated_at)}</small></td>
                </tr>
              );
            })}
          </Table>
        )}
      </Panel>
    </>
  );
}
