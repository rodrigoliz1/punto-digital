import Link from "next/link";
import { Badge, Empty, PageHeader, Panel, Table, date } from "@/components/prospect/ui";
import { requireProspectPage } from "@/lib/prospect/access";
import { listBrandAudits } from "@/lib/prospect/queries";

export const metadata = { title: "Análisis de marca" };

export default async function BrandPage() {
  const ctx = await requireProspectPage("/admin/prospectos/marca");
  const rows = await listBrandAudits(ctx.db);
  return (
    <>
      <PageHeader eyebrow="Analista de marca · Creativo" title="Análisis de marca y briefs" description="Cada versión registra fuentes, generador (determinista o Claude) y afirmaciones pendientes de verificar. Nada se publica sin autorización del negocio." />
      <Panel title="Briefs recientes">
        {rows.length === 0 ? <Empty title="Sin briefs todavía">Genera uno desde la ficha de un prospecto.</Empty> : (
          <Table head={["Negocio", "Versión", "Paleta", "Tono", "Generador", "Estado", "Fecha"]}>
            {rows.map((row) => <tr key={row.id}><td><Link className="po-row-link" href={`/admin/prospectos/p/${row.prospect_id}`}>{row.name}</Link><small>{row.category} · {row.city}</small></td><td>v{row.version}</td><td><div className="po-swatches">{row.palette.map((c, i) => <span key={`${c}${i}`} style={{ background: c }} title={c} />)}</div></td><td><small>{row.voice}</small></td><td><small>{row.generator}</small></td><td><Badge status={row.status} /></td><td><small>{date(row.created_at)}</small></td></tr>)}
          </Table>
        )}
      </Panel>
    </>
  );
}
