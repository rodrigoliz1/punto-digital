import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, JsonForm, PrepareSend, type Field } from "@/components/prospect/actions";
import { Badge, Empty, ExternalLink, KeyValue, mxn, Notice, PageHeader, Panel, ScoreBar, date } from "@/components/prospect/ui";
import { requireProspectPage } from "@/lib/prospect/access";
import { getProspectDetail, listCampaigns } from "@/lib/prospect/queries";
import { SIGNAL_LABELS } from "@/lib/prospect/scoring";
import { ProspectError, roleAtLeast, CHANNEL_LABELS, CHANNELS, ACTIVITY_TYPES, type Signals } from "@/lib/prospect/types";

export const metadata = { title: "Prospecto" };

const ACTIVITY_LABELS: Record<string, string> = { note: "Nota", reply: "Respuesta recibida", meeting: "Reunión", follow_up: "Seguimiento", won: "Cliente ganado", lost: "Perdido" };

export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireProspectPage(`/admin/prospectos/p/${id}`);
  const detail = await getProspectDetail(ctx.db, id).catch((error) => {
    if (error instanceof ProspectError && error.status === 404) notFound();
    throw error;
  });
  const campaigns = await listCampaigns(ctx.db);
  const { prospect: p } = detail;
  const can = (role: "operator" | "reviewer" | "admin") => roleAtLeast(ctx.actor.role, role);
  const api = `/api/prospect/prospects/${p.id}`;
  const brief = detail.brandAudits[0]?.brief ?? null;
  const currentDemo = detail.demos.find((d) => !["superseded", "revoked"].includes(d.status));
  const suppressed = p.status === "suppressed";
  const signalFields: Field[] = (Object.keys(SIGNAL_LABELS) as Array<keyof Signals>).map((key) => ({ name: `signals.${key}`, label: SIGNAL_LABELS[key], type: "number", min: 0, max: key === "posts_last_28d" ? 500 : 5, defaultValue: (detail.signals[key] as number | null | undefined) ?? null }));
  const contactFields: Field[] = [
    { name: "website", label: "Sitio web", type: "url", defaultValue: p.website },
    { name: "emailPublic", label: "Correo comercial publicado", type: "email", defaultValue: p.email_public },
    { name: "phonePublic", label: "Teléfono comercial", defaultValue: p.phone_public },
    { name: "instagramUrl", label: "Instagram", type: "url", defaultValue: p.instagram_url },
    { name: "zone", label: "Zona", defaultValue: p.zone },
    { name: "campaignId", label: "Campaña", type: "select", options: [{ value: "", label: "Sin campaña" }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))], defaultValue: p.campaign_id ?? "" },
    { name: "notes", label: "Notas internas", type: "textarea", defaultValue: p.notes },
  ];
  return (
    <>
      <PageHeader eyebrow={`${p.category} · ${[p.zone, p.city].filter(Boolean).join(", ")}`} title={p.name} description={`Fuente: ${p.source} · consultada ${date(p.source_checked_at)}${detail.campaign ? ` · Campaña: ${detail.campaign.name}` : ""}`} actions={<><Badge status={p.status} /><ScoreBar score={p.score} /></>} />
      {suppressed ? <Notice tone="danger">Prospecto excluido. No se permite ningún contacto futuro ni compartir demos.</Notice> : null}

      <Panel title="Flujo de trabajo" description="Los agentes preparan; una persona con rol de revisor aprueba y registra cada contacto.">
        <div className="po-actions">
          {can("operator") && !suppressed ? <>
            <ActionButton endpoint={`${api}/analyze`} label="1 · Analizar sitio web" />
            <ActionButton endpoint={`${api}/qualify`} label="2 · Calificar" />
            <ActionButton endpoint={`${api}/brief`} body={{ useLlm: false }} label="3 · Brief determinista" />
            <ActionButton endpoint={`${api}/brief`} body={{ useLlm: true }} label="3 · Brief con Claude" confirm="Se consumirá presupuesto de Claude. ¿Continuar?" />
            <ActionButton endpoint={`${api}/images`} body={{ count: 3 }} label="4 · Generar 3 imágenes" confirm="Se consumirá presupuesto del proveedor de imágenes. ¿Continuar?" disabled={!brief} />
            <ActionButton endpoint={`${api}/demo`} label="5 · Construir demo" disabled={!brief || !["qualified", "demo_ready"].includes(p.status)} />
          </> : null}
          {can("reviewer") && p.status === "demo_ready" ? <ActionButton endpoint={`${api}/approve`} label="6 · Aprobar prospecto y demo" variant="primary" confirm="Confirmo que revisé hechos, derechos de imagen y la demo." /> : null}
        </div>
        {!can("operator") ? <p className="po-muted">Tu rol es de lectura.</p> : null}
        {suppressed ? <p className="po-muted">Sin acciones disponibles: el prospecto está excluido y el historial se conserva solo para auditoría.</p> : null}
        {!suppressed && can("operator") && ["contacted", "replied", "meeting", "won", "lost"].includes(p.status) ? <p className="po-muted">El prospecto ya fue contactado: registra su avance en «Seguimiento y conversión».</p> : null}
      </Panel>

      <div className="po-grid-2">
        <Panel title="Calificación" description={detail.missing.length ? `Faltan ${detail.missing.length} señal(es); suman 0 hasta registrarlas.` : "Todas las señales registradas."}>
          <ul className="po-checks">{detail.scoreLines.map((line) => <li key={line.key} className={line.reason === "Sin evidencia registrada" ? "is-warning" : ""}><span><strong>{line.points}/{line.max}</strong> {line.label} <small>— {line.reason}</small></span></li>)}</ul>
          {can("operator") && !suppressed ? <details className="po-details"><summary>Editar señales</summary><JsonForm endpoint={api} method="PATCH" fields={signalFields} submitLabel="Guardar y recalcular" compact /></details> : null}
        </Panel>
        <Panel title="Datos comerciales">
          <KeyValue items={[["Sitio web", <ExternalLink key="w" href={p.website} />], ["Correo", p.email_public], ["Teléfono", p.phone_public], ["Instagram", <ExternalLink key="i" href={p.instagram_url} />], ["Facebook", <ExternalLink key="f" href={p.facebook_url} />], ["Dirección", p.address], ["Fuente", <ExternalLink key="s" href={p.source_url}>Ver fuente</ExternalLink>], ["Contenido de Places vence", p.places_content_expires_at ? date(p.places_content_expires_at) : "—"]]} />
          {can("operator") && !suppressed ? <details className="po-details"><summary>Editar datos</summary><JsonForm endpoint={api} method="PATCH" fields={contactFields} submitLabel="Guardar" compact /></details> : null}
        </Panel>
      </div>

      <div className="po-grid-2">
        <Panel title="Análisis de marca" description={detail.website ? `Sitio leído ${date(detail.evidence.find((e) => e.kind === "website")?.observed_at)}` : "Sin análisis de sitio todavía."}>
          {detail.website ? <>
            <KeyValue items={[["Título", detail.website.title], ["Descripción", detail.website.description], ["HTTPS", detail.website.https ? "Sí" : "No"], ["Generador", detail.website.generator], ["Secciones", detail.website.keywords.join(", ") || "—"]]} />
            {detail.website.palette.length ? <div className="po-swatches">{detail.website.palette.map((c, i) => <span key={`${c}${i}`} style={{ background: c }} title={c} />)}</div> : null}
            {detail.website.issues.length ? <ul className="po-checks">{detail.website.issues.map((issue, i) => <li key={i} className="is-warning">{issue}</li>)}</ul> : null}
          </> : <Empty title="Ejecuta «Analizar sitio web»">El contenido del sitio se trata como dato no confiable.</Empty>}
        </Panel>
        <Panel title="Brief creativo" description={detail.brandAudits[0] ? `v${detail.brandAudits[0].version} · ${detail.brandAudits[0].generator}` : undefined}>
          {brief ? <>
            <p>{brief.positioning}</p>
            <KeyValue items={[["Audiencia", brief.audience], ["Tono", brief.voice], ["Dirección visual", brief.visualDirection]]} />
            <div className="po-swatches">{brief.palette.map((c, i) => <span key={`${c}${i}`} style={{ background: c }} title={c} />)}</div>
            <p className="po-muted"><strong>Por verificar con el negocio:</strong> {brief.claimsToVerify.join(" · ")}</p>
            <details className="po-details"><summary>Prompts de imagen ({brief.assetPrompts.length})</summary><ol>{brief.assetPrompts.map((prompt, index) => <li key={index}><small>{prompt}</small></li>)}</ol></details>
          </> : <Empty title="Sin brief" />}
          {detail.assets.length ? <div className="po-assets">{detail.assets.map((asset) => <figure key={asset.id}>{/* Imagen privada servida con sesión; next/image no aplica. */}{/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/prospect/assets/${asset.id}`} alt="Concepto ilustrativo generado" loading="lazy" /><figcaption>Concepto ilustrativo · {asset.status === "approved" ? "aprobado" : "borrador"}</figcaption></figure>)}</div> : null}
        </Panel>
      </div>

      <Panel title="Demo" description="Página privada con avisos de simulación. Solo se comparte por enlace temporal tras aprobación humana.">
        {currentDemo ? <>
          <KeyValue items={[["Versión", `v${currentDemo.version}`], ["Estado", <Badge key="s" status={currentDemo.status} />], ["Aprobada por", currentDemo.approved_by], ["Vistas", currentDemo.view_count], ["Última vista", date(currentDemo.last_viewed_at, true)], ["Enlace vigente hasta", currentDemo.has_link ? date(currentDemo.access_expires_at, true) : "Sin enlace activo"]]} />
          <div className="po-actions">
            <a className="po-btn po-btn--secondary" href={`/admin/prospectos/demos/${currentDemo.id}/vista`} target="_blank" rel="noopener">Vista previa interna</a>
            {can("reviewer") && currentDemo.status === "approved" && !suppressed ? <><DemoLink demoId={currentDemo.id} /><ActionButton endpoint={`/api/prospect/demos/${currentDemo.id}/revoke`} label="Revocar demo" variant="danger" confirm="El enlace dejará de funcionar y el prospecto volverá a «Demo lista»." /></> : null}
          </div>
        </> : <Empty title="Sin demo">Requiere prospecto calificado y brief.</Empty>}
      </Panel>

      <Panel title="Mensajes" description="Borradores del agente de redacción. El sistema no envía: tú envías y registras el envío.">
        {can("operator") && ["approved", "contacted", "replied"].includes(p.status) ? (
          <JsonForm endpoint={`${api}/draft`} compact submitLabel="Redactar borrador" fields={[
            { name: "channel", label: "Canal", type: "select", options: CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] })) },
            { name: "step", label: "Paso", type: "select", numeric: true, options: [{ value: "1", label: "Primer contacto" }, { value: "2", label: "Seguimiento 1" }, { value: "3", label: "Seguimiento 2" }] },
            { name: "recipient", label: "Destinatario (opcional)", placeholder: "Por defecto, el canal público registrado" },
          ]} extra={{}} />
        ) : <p className="po-muted">Disponible cuando una persona aprueba el prospecto.</p>}
        {detail.messages.length === 0 ? null : detail.messages.map((message) => (
          <article key={message.id} className="po-message">
            <header><span><strong>{CHANNEL_LABELS[message.channel as keyof typeof CHANNEL_LABELS] ?? message.channel}</strong> · paso {message.step} · {message.recipient}</span><Badge status={message.status} /></header>
            {message.subject ? <strong>{message.subject}</strong> : null}
            <pre>{message.body}</pre>
            {message.review ? <ul className="po-checks">{message.review.checks.map((check) => <li key={check.id} className={check.passed ? "" : check.blocking ? "is-failed" : "is-warning"}><span>{check.label} <small>— {check.detail}</small></span></li>)}</ul> : null}
            <div className="po-actions">
              {message.status === "draft" && can("operator") ? <details className="po-details"><summary>Editar</summary><JsonForm endpoint={`/api/prospect/messages/${message.id}/edit`} submitLabel="Guardar y revisar" fields={[{ name: "subject", label: "Asunto", defaultValue: message.subject }, { name: "recipient", label: "Destinatario", defaultValue: message.recipient }, { name: "body", label: "Mensaje", type: "textarea", defaultValue: message.body, help: "Conserva {{enlace_propuesta}} y la línea de baja." }]} /></details> : null}
              {message.status === "draft" && can("reviewer") ? <ActionButton endpoint={`/api/prospect/messages/${message.id}/approve`} label="Aprobar mensaje" variant="primary" disabled={!message.review?.passed} /> : null}
              {message.status === "approved" && can("reviewer") ? <PrepareSend messageId={message.id} /> : null}
              {["draft", "approved"].includes(message.status) && can("operator") ? <ActionButton endpoint={`/api/prospect/messages/${message.id}/discard`} label="Descartar" variant="ghost" /> : null}
              {message.status === "sent" ? <small className="po-muted">Enviado manualmente por {message.sent_by} el {date(message.sent_at, true)}</small> : null}
            </div>
          </article>
        ))}
      </Panel>

      <div className="po-grid-2">
        <Panel title="Seguimiento y conversión">
          {can("operator") && !suppressed ? <JsonForm endpoint={`${api}/activity`} compact submitLabel="Registrar actividad" fields={[
            { name: "type", label: "Tipo", type: "select", options: ACTIVITY_TYPES.filter((t) => can("reviewer") || ["note", "follow_up"].includes(t)).map((t) => ({ value: t, label: ACTIVITY_LABELS[t] })) },
            { name: "scheduledAt", label: "Fecha agendada (reuniones)", type: "datetime" },
            { name: "dealValueMxn", label: "Valor del contrato MXN (cliente ganado)", type: "number", min: 0, step: 100 },
            { name: "summary", label: "Resumen", type: "textarea", required: true },
          ]} /> : null}
          {detail.activities.length === 0 ? <Empty title="Sin actividades" /> : <ul className="po-timeline">{detail.activities.map((a) => <li key={a.id}><time>{date(a.occurred_at, true)}</time><span><strong>{ACTIVITY_LABELS[a.type] ?? a.type}</strong>{a.scheduled_at ? ` · ${date(a.scheduled_at, true)}` : ""}{a.deal_value_mxn ? ` · ${mxn.format(a.deal_value_mxn)}` : ""}<br /><small>{a.summary} — {a.created_by}</small></span></li>)}</ul>}
        </Panel>
        <Panel title="Auditoría" description="Eventos de este prospecto, sus demos y mensajes.">
          <ul className="po-timeline">{detail.trail.map((t, index) => <li key={`${t.created_at}${index}`}><time>{date(t.created_at, true)}</time><span><code>{t.action}</code>{t.payload.to ? ` → ${String(t.payload.to)}` : ""}<br /><small>{String(t.payload.actor ?? "")}{t.payload.reason ? ` · ${String(t.payload.reason)}` : ""}</small></span></li>)}</ul>
        </Panel>
      </div>

      {can("operator") && !suppressed ? <Panel title="Solicitud de no contacto" description="Excluye este negocio y todos sus identificadores (correo, dominio, teléfono, Instagram, place_id).">
        <JsonForm endpoint={`${api}/suppress`} compact submitLabel="Excluir prospecto" confirm="Esta acción bloquea cualquier contacto futuro. ¿Continuar?" fields={[{ name: "reason", label: "Motivo", required: true, placeholder: "Respondió que no desea recibir mensajes" }]} />
      </Panel> : null}
      <p className="po-muted"><Link className="po-link" href="/admin/prospectos/lista">← Volver a prospectos</Link></p>
    </>
  );
}

function DemoLink({ demoId }: { demoId: string }) {
  return <JsonForm endpoint={`/api/prospect/demos/${demoId}/link`} fields={[]} submitLabel="Generar enlace privado (14 días)" resultMode="show" confirm="Se invalidará el enlace anterior. ¿Continuar?" />;
}
