import Link from "next/link";
import { Badge, Empty, PageHeader, Panel, Table, date } from "@/components/prospect/ui";
import { requireProspectPage } from "@/lib/prospect/access";
import { listDemos } from "@/lib/prospect/queries";

export const metadata = { title: "Demos" };

export default async function DemosPage() {
  const ctx = await requireProspectPage("/admin/prospectos/demos");
  const rows = await listDemos(ctx.db);
  return (
    <>
      <PageHeader eyebrow="Constructor de demos" title="Demos generadas" description="Páginas privadas con `noindex`, sin scripts y con avisos visibles de simulación. Los enlaces expiran a los 14 días y se pueden revocar." />
      <Panel title="Versiones vigentes">
        {rows.length === 0 ? <Empty title="Sin demos" /> : (
          <Table head={["Negocio", "Versión", "Estado", "Aprobada por", "Enlace", "Vistas", "Creada", ""]}>
            {rows.map((row) => <tr key={row.id}><td><Link className="po-row-link" href={`/admin/prospectos/p/${row.prospect_id}`}>{row.name}</Link></td><td>v{row.version}</td><td><Badge status={row.status} /></td><td><small>{row.approved_by ?? "—"}</small></td><td><small>{row.has_link ? `Vigente hasta ${date(row.access_expires_at)}` : "Sin enlace"}</small></td><td>{row.view_count}<small>{row.last_viewed_at ? date(row.last_viewed_at, true) : ""}</small></td><td><small>{date(row.created_at)}</small></td><td><a className="po-link" href={`/admin/prospectos/demos/${row.id}/vista`} target="_blank" rel="noopener">Ver</a></td></tr>)}
          </Table>
        )}
      </Panel>
    </>
  );
}
