import Link from "next/link";
import { Badge, Empty, mxn, PageHeader, Panel, pct, Stat, usd, date } from "@/components/prospect/ui";
import { requireProspectPage } from "@/lib/prospect/access";
import { PROVIDER_LABELS } from "@/lib/prospect/budget";
import { dashboardMetrics } from "@/lib/prospect/queries";
import { PROSPECT_STATUSES, STATUS_LABELS } from "@/lib/prospect/types";

export const metadata = { title: "Resumen" };

const FUNNEL = ["discovered", "qualified", "demo_ready", "approved", "contacted", "replied", "meeting", "won"] as const;

export default async function ProspectDashboard() {
  const ctx = await requireProspectPage("/admin/prospectos");
  const m = await dashboardMetrics(ctx.db, new Date());
  const max = Math.max(1, ...FUNNEL.map((s) => m.byStatus[s]));
  return (
    <>
      <PageHeader eyebrow="Prospect OS" title="Resumen comercial" description="Embudo de prospección asistida, aprobaciones pendientes, resultados y consumo de APIs. Ninguna cifra se estima: todo proviene de registros auditados." actions={<Link href="/admin/prospectos/descubrir" className="po-btn po-btn--primary">Buscar prospectos</Link>} />
      <div className="po-stats">
        <Stat label="Prospectos" value={m.total} hint={`${m.byStatus.qualified} calificados`} href="/admin/prospectos/lista" />
        <Stat label="Pendientes de aprobación" value={m.byStatus.demo_ready + m.pendingMessages} hint={`${m.byStatus.demo_ready} demos · ${m.pendingMessages} mensajes`} href="/admin/prospectos/campanas" />
        <Stat label="Contactos (30 días)" value={m.sentLast30} hint={`Respuesta ${pct(m.replyRate)}`} href="/admin/prospectos/seguimiento" />
        <Stat label="Clientes convertidos" value={m.won.n} hint={`Cierre ${pct(m.winRate)}`} href="/admin/prospectos/clientes" />
        <Stat label="Ingresos firmados" value={mxn.format(m.won.revenue)} hint="Valor registrado al cerrar" href="/admin/prospectos/clientes" />
        <Stat label="Gasto en APIs (mes)" value={usd(m.spendThisMonthMicros)} hint={m.costPerWonMicros === null ? "Sin clientes aún" : `${usd(m.costPerWonMicros)} por cliente`} href="/admin/prospectos/costos" />
      </div>
      <div className="po-grid-3">
        <Panel title="Embudo" description="Estado actual de cada prospecto.">
          {m.total === 0 ? <Empty title="Aún no hay prospectos">Empieza en Prospección con Google Places o importa registros con fuente verificada.</Empty> : (
            <div className="po-funnel">
              {FUNNEL.map((status) => <div key={status}><span>{STATUS_LABELS[status]}</span><i style={{ width: `${(m.byStatus[status] / max) * 100}%` }} /><b>{m.byStatus[status]}</b></div>)}
              <p className="po-muted">Perdidos: {m.byStatus.lost} · Excluidos: {m.byStatus.suppressed}</p>
            </div>
          )}
        </Panel>
        <Panel title="Próximas reuniones">
          {m.upcomingMeetings.length === 0 ? <Empty title="Sin reuniones agendadas" /> : (
            <ul className="po-timeline">{m.upcomingMeetings.map((meeting) => <li key={`${meeting.prospect_id}${meeting.scheduled_at}`}><time>{date(meeting.scheduled_at, true)}</time><span><Link className="po-link" href={`/admin/prospectos/p/${meeting.prospect_id}`}>{meeting.name}</Link><br /><small>{meeting.summary}</small></span></li>)}</ul>
          )}
        </Panel>
      </div>
      <div className="po-grid-2">
        <Panel title="Demos" description="Vistas registradas por enlace privado.">
          <div className="po-stats"><Stat label="Generadas" value={m.demos.total} /><Stat label="Aprobadas" value={m.demos.approved ?? 0} /><Stat label="Vistas" value={m.demos.views ?? 0} /></div>
        </Panel>
        <Panel title="Presupuesto por proveedor" description="Las llamadas con costo se bloquean al llegar al límite.">
          {m.spendByProvider.map(({ provider, micros, budget }) => {
            const limit = (budget?.monthly_limit_usd_cents ?? 0) * 10_000;
            const ratio = limit ? Math.min(1, micros / limit) : 0;
            return <div key={provider}><div className="po-actions" style={{ justifyContent: "space-between" }}><span>{PROVIDER_LABELS[provider]}</span>{budget?.enabled ? <small>{usd(micros)} de {usd(limit)}</small> : <Badge status="paused" label="Deshabilitado" />}</div><div className={`po-meter${ratio >= 0.9 ? " po-meter--over" : ""}`}><i style={{ width: `${ratio * 100}%` }} /></div></div>;
          })}
        </Panel>
      </div>
      <p className="po-muted">Estados disponibles: {PROSPECT_STATUSES.map((s) => STATUS_LABELS[s]).join(" → ")}. El contacto automatizado está deshabilitado.</p>
    </>
  );
}
