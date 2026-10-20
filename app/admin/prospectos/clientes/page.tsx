import Link from "next/link";
import { Empty, mxn, PageHeader, Panel, pct, Stat, Table, usd, date } from "@/components/prospect/ui";
import { requireProspectPage } from "@/lib/prospect/access";
import { dashboardMetrics, listClients } from "@/lib/prospect/queries";

export const metadata = { title: "Clientes y finanzas" };

export default async function ClientsPage() {
  const ctx = await requireProspectPage("/admin/prospectos/clientes");
  const [clients, metrics] = await Promise.all([listClients(ctx.db), dashboardMetrics(ctx.db, new Date())]);
  const revenue = clients.reduce((sum, c) => sum + (c.deal_value_mxn ?? 0), 0);
  const average = clients.length ? revenue / clients.length : 0;
  return (
    <>
      <PageHeader eyebrow="Conversiones" title="Clientes convertidos y métricas financieras" description="Ingresos registrados por una persona al cerrar cada oportunidad. El costo de adquisición incluye solo el consumo de APIs registrado; añade tu tiempo y otros costos para calcular el margen real." />
      <div className="po-stats">
        <Stat label="Clientes" value={clients.length} />
        <Stat label="Ingresos firmados" value={mxn.format(revenue)} />
        <Stat label="Ticket promedio" value={clients.length ? mxn.format(average) : "—"} />
        <Stat label="Tasa de cierre" value={pct(metrics.winRate)} hint="Sobre prospectos contactados" />
        <Stat label="Costo de APIs por cliente" value={metrics.costPerWonMicros === null ? "—" : usd(metrics.costPerWonMicros)} hint="Acumulado histórico" />
      </div>
      <Panel title="Clientes">
        {clients.length === 0 ? <Empty title="Aún no hay clientes convertidos">Registra «Cliente ganado» con el valor del contrato desde la ficha del prospecto.</Empty> : (
          <Table head={["Cliente", "Giro", "Valor", "Fecha", "Resumen", "Registró"]}>
            {clients.map((c) => <tr key={`${c.id}${c.occurred_at}`}><td><Link className="po-row-link" href={`/admin/prospectos/p/${c.id}`}>{c.name}</Link><small>{c.city}</small></td><td><small>{c.category}</small></td><td>{c.deal_value_mxn ? mxn.format(c.deal_value_mxn) : "—"}</td><td><small>{date(c.occurred_at)}</small></td><td><small>{c.summary}</small></td><td><small>{c.created_by}</small></td></tr>)}
          </Table>
        )}
      </Panel>
    </>
  );
}
