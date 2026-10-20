import { Empty, PageHeader, Panel, Stat, Table, usd, date } from "@/components/prospect/ui";
import { requireProspectPage } from "@/lib/prospect/access";
import { PROVIDER_LABELS, type Provider } from "@/lib/prospect/budget";
import { dashboardMetrics, usageSummary } from "@/lib/prospect/queries";

export const metadata = { title: "Costos de APIs" };

export default async function CostsPage() {
  const ctx = await requireProspectPage("/admin/prospectos/costos");
  const [usage, metrics] = await Promise.all([usageSummary(ctx.db), dashboardMetrics(ctx.db, new Date())]);
  return (
    <>
      <PageHeader eyebrow="Consumo" title="Costos y consumo de APIs" description="Claude registra el costo real según los tokens devueltos. Google Places e imágenes usan estimaciones por llamada: concílialas con la consola de cada proveedor." />
      <div className="po-stats">
        {metrics.spendByProvider.map((p) => <Stat key={p.provider} label={PROVIDER_LABELS[p.provider]} value={usd(p.micros)} hint={p.budget?.enabled ? `Límite ${usd(p.budget.monthly_limit_usd_cents * 10_000)} / mes` : "Deshabilitado"} />)}
      </div>
      <Panel title="Por mes y operación">
        {usage.monthly.length === 0 ? <Empty title="Sin consumo registrado" /> : (
          <Table head={["Mes", "Proveedor", "Operación", "Llamadas", "Costo"]}>
            {usage.monthly.map((row) => <tr key={`${row.month}${row.provider}${row.operation}`}><td>{row.month}</td><td>{PROVIDER_LABELS[row.provider as Provider] ?? row.provider}</td><td><small>{row.operation}</small></td><td>{row.units}</td><td>{usd(row.micros)}</td></tr>)}
          </Table>
        )}
      </Panel>
      <Panel title="Últimas llamadas">
        {usage.recent.length === 0 ? <Empty title="Sin llamadas" /> : (
          <Table head={["Fecha", "Proveedor", "Operación", "Prospecto", "Costo"]}>
            {usage.recent.map((row) => <tr key={row.id}><td><small>{date(row.created_at, true)}</small></td><td>{PROVIDER_LABELS[row.provider as Provider] ?? row.provider}</td><td><small>{row.operation}</small></td><td><small>{row.name ?? "—"}</small></td><td>{usd(row.cost_usd_micros)}</td></tr>)}
          </Table>
        )}
      </Panel>
    </>
  );
}
