import { JsonForm, type Field } from "@/components/prospect/actions";
import { Empty, Notice, PageHeader, Panel, Table, date } from "@/components/prospect/ui";
import { requireProspectPage } from "@/lib/prospect/access";
import { listSuppressions } from "@/lib/prospect/queries";
import { roleAtLeast } from "@/lib/prospect/types";

export const metadata = { title: "Exclusiones" };

const KIND_LABELS: Record<string, string> = { email: "Correo", domain: "Dominio", phone: "Teléfono", instagram: "Instagram", place_id: "Google place_id" };
const SOURCE_LABELS: Record<string, string> = { opt_out_reply: "Respuesta de baja", manual: "Manual", legal_request: "Solicitud ARCO / legal", bounce: "Rebote" };

const fields: Field[] = [
  { name: "kind", label: "Tipo", type: "select", options: Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label })) },
  { name: "value", label: "Valor", required: true, placeholder: "correo@negocio.mx, negocio.mx, 3312345678, @usuario" },
  { name: "source", label: "Origen", type: "select", options: Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label })) },
  { name: "reason", label: "Motivo", required: true },
];

export default async function SuppressionsPage() {
  const ctx = await requireProspectPage("/admin/prospectos/exclusiones");
  const rows = await listSuppressions(ctx.db);
  return (
    <>
      <PageHeader eyebrow="Cumplimiento" title="Exclusiones y solicitudes de no contacto" description="Una exclusión bloquea importaciones, borradores, aprobaciones, envíos y enlaces de demo de forma inmediata. No se elimina desde el panel." />
      <Notice tone="warn">Las solicitudes ARCO (acceso, rectificación, cancelación, oposición) conforme a la LFPDPPP deben atenderse además por el procedimiento del aviso de privacidad. Sujeto a revisión jurídica.</Notice>
      {roleAtLeast(ctx.actor.role, "operator") ? <Panel title="Registrar exclusión"><JsonForm endpoint="/api/prospect/suppressions" fields={fields} submitLabel="Excluir" resultMode="show" /></Panel> : null}
      <Panel title={`Lista de supresión (${rows.length})`}>
        {rows.length === 0 ? <Empty title="Sin exclusiones" /> : (
          <Table head={["Tipo", "Valor", "Origen", "Motivo", "Registró", "Fecha"]}>
            {rows.map((r) => <tr key={r.id}><td>{KIND_LABELS[r.kind] ?? r.kind}</td><td><code>{r.value}</code></td><td><small>{SOURCE_LABELS[r.source] ?? r.source}</small></td><td><small>{r.reason}</small></td><td><small>{r.created_by}</small></td><td><small>{date(r.created_at)}</small></td></tr>)}
          </Table>
        )}
      </Panel>
    </>
  );
}
