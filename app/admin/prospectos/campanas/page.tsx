import Link from "next/link";
import { ActionButton, JsonForm, PrepareSend, type Field } from "@/components/prospect/actions";
import { Badge, Empty, Notice, PageHeader, Panel, Table, date } from "@/components/prospect/ui";
import { requireProspectPage } from "@/lib/prospect/access";
import { listCampaigns, listMessages } from "@/lib/prospect/queries";
import { CHANNEL_LABELS, roleAtLeast, type Channel } from "@/lib/prospect/types";

export const metadata = { title: "Campañas y aprobación" };

const campaignFields: Field[] = [
  { name: "name", label: "Nombre", required: true, placeholder: "Cafeterías Providencia — otoño" },
  { name: "city", label: "Ciudad", type: "select", options: [{ value: "", label: "Cualquiera" }, { value: "Guadalajara", label: "Guadalajara" }, { value: "Zapopan", label: "Zapopan" }] },
  { name: "zone", label: "Zona" },
  { name: "category", label: "Giro" },
  { name: "dailyContactCap", label: "Límite de contactos por día", type: "number", min: 1, max: 50, defaultValue: 10 },
  { name: "status", label: "Estado", type: "select", options: [{ value: "draft", label: "Borrador" }, { value: "active", label: "Activa" }, { value: "paused", label: "Pausada" }, { value: "closed", label: "Cerrada" }] },
  { name: "notes", label: "Notas", type: "textarea" },
];

export default async function CampaignsPage() {
  const ctx = await requireProspectPage("/admin/prospectos/campanas");
  const [campaigns, queue] = await Promise.all([listCampaigns(ctx.db), listMessages(ctx.db, ["draft", "approved"])]);
  const reviewer = roleAtLeast(ctx.actor.role, "reviewer");
  return (
    <>
      <PageHeader eyebrow="Agente de redacción · Supervisor" title="Campañas y bandeja de aprobación" description="Los mensajes pasan por el supervisor de cumplimiento y requieren aprobación humana. El envío es siempre manual y queda registrado." />
      <Notice>El contacto automatizado está deshabilitado. No existe endpoint de envío: Prospect OS prepara el texto y tú lo envías por el canal autorizado.</Notice>
      <Panel title={`Bandeja (${queue.length})`} description="Borradores y mensajes aprobados pendientes de envío.">
        {queue.length === 0 ? <Empty title="Nada pendiente" /> : queue.map((message) => (
          <article key={message.id} className="po-message">
            <header><span><Link className="po-link" href={`/admin/prospectos/p/${message.prospect_id}`}>{message.prospect_name}</Link> · {CHANNEL_LABELS[message.channel as Channel] ?? message.channel} · paso {message.step} · {message.recipient}</span><Badge status={message.status} /></header>
            <pre>{message.body}</pre>
            {message.review ? <ul className="po-checks">{message.review.checks.filter((c) => !c.passed).map((check) => <li key={check.id} className={check.blocking ? "is-failed" : "is-warning"}><span>{check.label} <small>— {check.detail}</small></span></li>)}{message.review.passed ? <li>Revisión de cumplimiento aprobada</li> : null}</ul> : null}
            <div className="po-actions">
              {reviewer && message.status === "draft" ? <ActionButton endpoint={`/api/prospect/messages/${message.id}/approve`} label="Aprobar" variant="primary" disabled={!message.review?.passed} /> : null}
              {reviewer && message.status === "approved" ? <PrepareSend messageId={message.id} /> : null}
              <ActionButton endpoint={`/api/prospect/messages/${message.id}/discard`} label="Descartar" variant="ghost" />
            </div>
          </article>
        ))}
      </Panel>
      <Panel title="Campañas">
        {campaigns.length === 0 ? <Empty title="Sin campañas" /> : (
          <Table head={["Campaña", "Segmento", "Estado", "Límite diario", "Prospectos", "Enviados", "Respondieron"]}>
            {campaigns.map((c) => <tr key={c.id}><td><strong>{c.name}</strong>{c.notes ? <small>{c.notes}</small> : null}</td><td><small>{[c.category, c.zone, c.city].filter(Boolean).join(" · ") || "General"}</small></td><td><Badge status={c.status} /></td><td>{c.daily_contact_cap}</td><td>{c.prospects}</td><td>{c.sent}</td><td>{c.responded}</td></tr>)}
          </Table>
        )}
        {reviewer ? <details className="po-details"><summary>Nueva campaña</summary><JsonForm endpoint="/api/prospect/settings/campaigns" fields={campaignFields} submitLabel="Crear campaña" /></details> : null}
      </Panel>
      <p className="po-muted">Última actualización: {date(new Date().toISOString(), true)}</p>
    </>
  );
}
