import { ActionButton, JsonForm } from "@/components/prospect/actions";
import { Badge, GENERIC_LABELS, Notice, PageHeader, Panel, Table, date, usd } from "@/components/prospect/ui";
import { requireProspectPage } from "@/lib/prospect/access";
import { PROVIDER_LABELS, PROVIDERS } from "@/lib/prospect/budget";
import { getSettings } from "@/lib/prospect/queries";
import { AGENT_LABELS, ROLE_LABELS, roleAtLeast, type Role } from "@/lib/prospect/types";

export const metadata = { title: "Configuración" };

const PROVIDER_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  researcher: [{ value: "google_places", label: "Google Places API" }],
  creative: [{ value: "deterministic", label: "Determinista" }, { value: "anthropic", label: "Claude (Anthropic)" }],
};

export default async function SettingsPage() {
  const ctx = await requireProspectPage("/admin/prospectos/configuracion");
  const settings = await getSettings(ctx.db);
  const ownerList = (process.env.ADMIN_EMAIL ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const ownerAccounts = ownerList.length ? (await ctx.db.prepare(`SELECT email, last_login_at FROM staff_accounts WHERE email IN (${ownerList.map(() => "?").join(",")})`).bind(...ownerList).all<{ email: string; last_login_at: string | null }>()).results : [];
  const admin = roleAtLeast(ctx.actor.role, "admin");
  const owner = ctx.actor.role === "owner";
  const credentials = [["GOOGLE_PLACES_API_KEY", Boolean(ctx.env.GOOGLE_PLACES_API_KEY)], ["ANTHROPIC_API_KEY", Boolean(ctx.env.ANTHROPIC_API_KEY)], ["OPENAI_API_KEY", Boolean(ctx.env.OPENAI_API_KEY)]] as const;
  return (
    <>
      <PageHeader eyebrow="Administración" title="Agentes, presupuestos y equipo" description="Los cambios quedan auditados. Las credenciales viven solo en variables de entorno o el gestor de secretos; aquí solo se muestra si están configuradas." />
      {!admin ? <Notice>Solo administradores pueden modificar esta sección.</Notice> : null}
      <Panel title="Credenciales" description="Nunca se muestran ni se registran sus valores.">
        <div className="po-actions">{credentials.map(([name, present]) => <span key={name}><code>{name}</code> <Badge status={present ? "active" : "paused"} label={present ? "Configurada" : "Ausente"} /></span>)}</div>
      </Panel>
      <Panel title="Agentes" description="Habilita, elige proveedor y ajusta parámetros. Ningún agente puede aprobar, enviar ni saltarse la revisión humana.">
        {settings.agents.map((agent) => (
          <article key={agent.agent} className="po-message">
            <header><span><strong>{AGENT_LABELS[agent.agent].name}</strong> · <small>{AGENT_LABELS[agent.agent].description}</small></span><Badge status={agent.enabled ? "active" : "paused"} label={agent.enabled ? "Habilitado" : "Deshabilitado"} /></header>
            {admin ? <JsonForm endpoint="/api/prospect/settings/agents" compact submitLabel="Guardar" extra={{ agent: agent.agent }} fields={[
              { name: "enabled", label: "Habilitado", type: "checkbox", defaultValue: agent.enabled },
              { name: "provider", label: "Proveedor", type: "select", options: PROVIDER_OPTIONS[agent.agent] ?? [{ value: "deterministic", label: "Determinista" }], defaultValue: agent.provider },
              ...(agent.agent === "creative" ? [
                { name: "model", label: "Modelo de Claude", defaultValue: agent.model ?? "claude-opus-5-5" },
                { name: "settings.effort", label: "Esfuerzo", type: "select" as const, options: [{ value: "low", label: "Bajo" }, { value: "medium", label: "Medio" }, { value: "high", label: "Alto" }], defaultValue: agent.settings.effort ?? "medium" },
                { name: "settings.imageProvider", label: "Proveedor de imágenes", type: "select" as const, options: [{ value: "none", label: "Ninguno" }, { value: "openai", label: "OpenAI (gpt-image-1)" }], defaultValue: agent.settings.imageProvider ?? "none" },
                { name: "settings.imageModel", label: "Modelo de imágenes", defaultValue: agent.settings.imageModel ?? "gpt-image-1" },
              ] : []),
              ...(agent.agent === "qualifier" ? [{ name: "settings.threshold", label: "Umbral para calificar (0–100)", type: "number" as const, min: 0, max: 100, defaultValue: agent.settings.threshold ?? 70 }] : []),
              ...(agent.agent === "outreach_writer" ? [{ name: "settings.senderName", label: "Firma", defaultValue: agent.settings.senderName ?? "Equipo Punto Digital" }] : []),
            ]} /> : null}
          </article>
        ))}
      </Panel>
      <Panel title="Presupuestos mensuales" description="Sin presupuesto habilitado no se realiza ninguna llamada con costo.">
        <Table head={["Proveedor", "Límite", "Estado", "Actualizado"]}>
          {PROVIDERS.map((provider) => {
            const budget = settings.budgets.find((b) => b.provider === provider);
            return <tr key={provider}><td>{PROVIDER_LABELS[provider]}</td><td>{budget ? usd(budget.monthly_limit_usd_cents * 10_000) : "—"}</td><td><Badge status={budget?.enabled ? "active" : "paused"} label={budget?.enabled ? "Habilitado" : "Deshabilitado"} /></td><td><small>{budget ? `${budget.updated_by} · ${date(budget.updated_at)}` : "—"}</small></td></tr>;
          })}
        </Table>
        {admin ? <JsonForm endpoint="/api/prospect/settings/budgets" compact submitLabel="Guardar presupuesto" fields={[
          { name: "provider", label: "Proveedor", type: "select", options: PROVIDERS.map((p) => ({ value: p, label: PROVIDER_LABELS[p] })) },
          { name: "monthlyLimitUsd", label: "Límite mensual (USD)", type: "number", min: 0, max: 5000, step: 1, required: true },
          { name: "enabled", label: "Habilitado", type: "checkbox" },
        ]} /> : null}
      </Panel>
      <Panel title="Propietarios" description="Definidos en ADMIN_EMAIL. La primera cuenta se activa con AUTH_SETUP_TOKEN; las demás, con invitación de un propietario.">
        <Table head={["Correo", "Acceso", ""]}>
          {ownerList.map((email) => {
            const account = ownerAccounts.find((a) => a.email === email);
            return <tr key={email}><td>{email}</td><td><small>{account ? `Activado${account.last_login_at ? ` · último acceso ${date(account.last_login_at, true)}` : ""}` : "Sin activar"}</small></td><td>{owner && email !== ctx.actor.email ? <div className="po-actions"><JsonForm endpoint="/api/auth/invite" fields={[]} extra={{ email }} submitLabel={account ? "Restablecer acceso" : "Generar invitación"} resultMode="show" /><ActionButton endpoint="/api/auth/revoke-sessions" body={{ email }} label="Cerrar sesiones" variant="ghost" /></div> : null}</td></tr>;
          })}
        </Table>
      </Panel>
      <Panel title="Equipo y roles" description="Los propietarios se definen en ADMIN_EMAIL. Lectura < Operador < Revisor < Administrador.">
        <Table head={["Correo", "Rol", "Estado", "Acceso", "Agregado por", ""]}>
          {settings.team.map((m) => <tr key={m.email}><td>{m.email}</td><td>{ROLE_LABELS[m.role as Role] ?? m.role}</td><td><Badge status={m.active ? "active" : "paused"} label={m.active ? "Activo" : "Inactivo"} /></td><td><small>{m.has_account ? `Activado${m.last_login_at ? ` · último acceso ${date(m.last_login_at, true)}` : ""}` : "Sin activar"}</small></td><td><small>{m.added_by}</small></td><td>{admin && m.email !== ctx.actor.email && (m.role !== "admin" || owner) ? <div className="po-actions"><JsonForm endpoint="/api/auth/invite" fields={[]} extra={{ email: m.email }} submitLabel={m.has_account ? "Restablecer acceso" : "Generar invitación"} resultMode="show" confirm={m.has_account ? "Se invalidará su contraseña y segundo factor actuales cuando use el enlace. ¿Continuar?" : undefined} /><ActionButton endpoint="/api/auth/revoke-sessions" body={{ email: m.email }} label="Cerrar sesiones" variant="ghost" /></div> : null}</td></tr>)}
        </Table>
        <p className="po-muted">Los enlaces de invitación son de un solo uso, vencen en 72 horas y se muestran una sola vez. Compártelos por un canal privado.</p>
        {admin ? <JsonForm endpoint="/api/prospect/settings/team" compact submitLabel="Guardar miembro" fields={[
          { name: "email", label: "Correo", type: "email", required: true },
          { name: "role", label: "Rol", type: "select", options: (["viewer", "operator", "reviewer", ...(owner ? ["admin"] : [])] as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] })) },
          { name: "active", label: "Activo", type: "checkbox", defaultValue: true },
        ]} /> : null}
      </Panel>
      <Panel title="Trabajos de agentes" description="Ejecuciones idempotentes con reintento (máx. 3 intentos por solicitud).">
        <div className="po-actions">{settings.jobs.length === 0 ? <small className="po-muted">Sin ejecuciones.</small> : settings.jobs.map((j) => <span key={`${j.agent}${j.status}`}>{AGENT_LABELS[j.agent as keyof typeof AGENT_LABELS]?.name ?? j.agent} <Badge status={j.status} label={`${GENERIC_LABELS[j.status] ?? j.status} · ${j.n}`} /></span>)}</div>
      </Panel>
      {admin ? <Panel title="Mantenimiento" description="Purga el contenido de Google Places con más de 30 días (dirección, teléfono y sitio no verificado). El place_id se conserva.">
        <ActionButton endpoint="/api/prospect/settings/purge-places" label="Purgar contenido de Places vencido" variant="danger" confirm="Se eliminarán datos de Places vencidos. ¿Continuar?" />
      </Panel> : null}
    </>
  );
}
