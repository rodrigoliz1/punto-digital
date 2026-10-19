import Link from "next/link";
import { Empty, PageHeader, Panel, Table, date } from "@/components/prospect/ui";
import { requireProspectPage } from "@/lib/prospect/access";
import { listAudit } from "@/lib/prospect/queries";

export const metadata = { title: "Auditoría" };

export default async function AuditPage() {
  const ctx = await requireProspectPage("/admin/prospectos/auditoria");
  const rows = await listAudit(ctx.db);
  return (
    <>
      <PageHeader eyebrow="Trazabilidad" title="Registro de auditoría" description="Últimos 200 eventos de Prospect OS. Cada transición de estado, aprobación, envío manual, exclusión y cambio de configuración queda registrado con su autor." />
      <Panel title="Eventos">
        {rows.length === 0 ? <Empty title="Sin eventos" /> : (
          <Table head={["Fecha", "Acción", "Entidad", "Autor", "Detalle"]}>
            {rows.map((row) => {
              const { actor, ...rest } = row.payload;
              return <tr key={row.id}><td><small>{date(row.created_at, true)}</small></td><td><code>{row.action}</code></td><td>{row.entity_type === "prospect" && row.entity_id !== "*" ? <Link className="po-link" href={`/admin/prospectos/p/${row.entity_id}`}>{row.entity_type}</Link> : <small>{row.entity_type} · {row.entity_id}</small>}</td><td><small>{String(actor ?? "—")}</small></td><td><small>{Object.entries(rest).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ").slice(0, 220)}</small></td></tr>;
            })}
          </Table>
        )}
      </Panel>
    </>
  );
}
