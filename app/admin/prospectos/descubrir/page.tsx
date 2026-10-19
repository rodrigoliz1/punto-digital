import { JsonForm, type Field } from "@/components/prospect/actions";
import { Notice, PageHeader, Panel } from "@/components/prospect/ui";
import { requireProspectPage } from "@/lib/prospect/access";
import { listCampaigns } from "@/lib/prospect/queries";

export const metadata = { title: "Prospección" };

const CATEGORIES = ["cafetería", "restaurante", "spa", "barbería", "estudio de pilates", "clínica dental", "despacho jurídico", "inmobiliaria", "boutique", "estudio de yoga"];

const IMPORT_EXAMPLE = JSON.stringify({ prospects: [{ name: "Café Ejemplo", category: "cafetería", city: "Guadalajara", zone: "Providencia", sourceUrl: "https://directorio.example.org/cafe-ejemplo", website: "https://example.org", emailPublic: null, instagramUrl: null, signals: { budget_fit: 3, presence_gap: 4, posts_last_28d: 4, product_quality: 4, contact_quality: 3, service_fit: 4 } }] }, null, 2);

export default async function DiscoverPage() {
  const ctx = await requireProspectPage("/admin/prospectos/descubrir", "operator");
  const campaigns = await listCampaigns(ctx.db);
  const campaignOptions = [{ value: "", label: "Sin campaña" }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))];
  const discoverFields: Field[] = [
    { name: "category", label: "Giro", type: "select", options: CATEGORIES.map((c) => ({ value: c, label: c })), required: true },
    { name: "city", label: "Ciudad", type: "select", options: [{ value: "Guadalajara", label: "Guadalajara" }, { value: "Zapopan", label: "Zapopan" }], required: true },
    { name: "zone", label: "Zona o colonia", placeholder: "Providencia, Chapalita, Andares…" },
    { name: "pageSize", label: "Resultados (máx. 20)", type: "number", min: 1, max: 20, defaultValue: 20 },
    { name: "campaignId", label: "Campaña", type: "select", options: campaignOptions },
  ];
  const manualFields: Field[] = [
    { name: "name", label: "Nombre del negocio", required: true },
    { name: "category", label: "Giro", required: true, placeholder: "cafetería" },
    { name: "city", label: "Ciudad", type: "select", options: [{ value: "Guadalajara", label: "Guadalajara" }, { value: "Zapopan", label: "Zapopan" }], required: true },
    { name: "zone", label: "Zona" },
    { name: "sourceUrl", label: "URL de la fuente", type: "url", required: true, help: "Página pública donde verificaste el negocio." },
    { name: "website", label: "Sitio web", type: "url" },
    { name: "emailPublic", label: "Correo comercial publicado", type: "email", help: "Nunca correos personales." },
    { name: "phonePublic", label: "Teléfono comercial publicado" },
    { name: "instagramUrl", label: "Instagram público", type: "url" },
    { name: "campaignId", label: "Campaña", type: "select", options: campaignOptions },
  ];
  return (
    <>
      <PageHeader eyebrow="Agente investigador" title="Prospección geográfica" description="Descubre negocios por ciudad, zona y giro con Google Places API (oficial). Cada registro conserva su fuente y la fecha de consulta." />
      <Notice tone="warn">Google Places solo se consulta con presupuesto activo (Configuración → Presupuestos). El contenido de Places distinto del place_id se purga a los 30 días. Revisa los términos vigentes de Google Maps Platform antes de operar a escala.</Notice>
      <Panel title="Buscar con Google Places" description="Los resultados entran como «Descubierto»; los duplicados y contactos excluidos se omiten.">
        <JsonForm endpoint="/api/prospect/discover" fields={discoverFields} submitLabel="Buscar negocios" resultMode="show" />
      </Panel>
      <div className="po-grid-2">
        <Panel title="Alta manual" description="Para negocios verificados en una fuente pública con términos compatibles.">
          <JsonForm endpoint="/api/prospect/prospects" fields={manualFields} submitLabel="Agregar prospecto" resultMode="redirect" redirectBase="/admin/prospectos/p/" />
        </Panel>
        <Panel title="Importar JSON" description="Hasta 100 registros por lote. Cada uno requiere sourceUrl.">
          <JsonForm endpoint="/api/prospect/prospects/import" fields={[{ name: "prospects", label: "Registros", type: "json", required: true, defaultValue: JSON.stringify(JSON.parse(IMPORT_EXAMPLE).prospects, null, 2) }]} submitLabel="Importar" resultMode="show" />
        </Panel>
      </div>
    </>
  );
}
