import Link from "next/link";
import { Badge, Empty, PageHeader, Panel, Table, date } from "@/components/prospect/ui";
import { requireProspectPage } from "@/lib/prospect/access";
import { listFollowUps, listMessages } from "@/lib/prospect/queries";

export const metadata = { title: "Seguimiento y reuniones" };

export default async function FollowUpPage() {
  const ctx = await requireProspectPage("/admin/prospectos/seguimiento");
  const now = new Date();
  const [{ waiting, meetings }, sent] = await Promise.all([listFollowUps(ctx.db, now), listMessages(ctx.db, ["sent"])]);
  return (
    <>
      <PageHeader eyebrow="Seguimiento" title="Seguimientos y reuniones" description="Prospectos contactados sin actividad reciente y reuniones agendadas. Los seguimientos respetan exclusiones y la frecuencia máxima de un contacto por semana." />
      <Panel title="Esperando respuesta" description="Marcados cuando pasaron 5 días sin actividad.">
        {waiting.length === 0 ? <Empty title="Sin prospectos en espera" /> : (
          <Table head={["Negocio", "Estado", "Último envío", "Última actividad", ""]}>
            {waiting.map((w) => <tr key={w.id}><td><Link className="po-row-link" href={`/admin/prospectos/p/${w.id}`}>{w.name}</Link><small>{w.city}</small></td><td><Badge status={w.status} /></td><td><small>{date(w.last_sent, true)}</small></td><td><small>{date(w.last_activity, true)}</small></td><td>{w.due ? <Badge status="paused" label="Toca seguimiento" /> : null}</td></tr>)}
          </Table>
        )}
      </Panel>
      <Panel title="Reuniones">
        {meetings.length === 0 ? <Empty title="Sin reuniones registradas" /> : (
          <Table head={["Fecha", "Negocio", "Estado", "Resumen", "Registró"]}>
            {meetings.map((m) => <tr key={m.id}><td><small>{date(m.scheduled_at, true)}</small>{m.scheduled_at && new Date(m.scheduled_at) > now ? <Badge status="active" label="Próxima" /> : null}</td><td><Link className="po-row-link" href={`/admin/prospectos/p/${m.prospect_id}`}>{m.name}</Link></td><td><Badge status={m.status} /></td><td><small>{m.summary}</small></td><td><small>{m.created_by}</small></td></tr>)}
          </Table>
        )}
      </Panel>
      <Panel title="Historial de envíos manuales">
        {sent.length === 0 ? <Empty title="Sin envíos registrados" /> : (
          <Table head={["Fecha", "Negocio", "Canal", "Paso", "Registró"]}>
            {sent.map((m) => <tr key={m.id}><td><small>{date(m.sent_at, true)}</small></td><td><Link className="po-row-link" href={`/admin/prospectos/p/${m.prospect_id}`}>{m.prospect_name}</Link></td><td>{m.channel}</td><td>{m.step}</td><td><small>{m.sent_by}</small></td></tr>)}
          </Table>
        )}
      </Panel>
    </>
  );
}
