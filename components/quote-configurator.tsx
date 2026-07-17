"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, CreditCard, Loader2, RotateCcw, Send } from "lucide-react";
import { ADDONS, PRODUCTS, calculateQuote, formatMoney } from "@/config/products";
import { INDUSTRIES, PROJECT_TYPES } from "@/config/preview";
import { LivePreview, DEFAULT_PREVIEW_PREFERENCES } from "@/components/preview/live-preview";
import { migrateQuoteDraft } from "@/lib/preview-engine";
import { trackPreviewEvent } from "@/lib/analytics";
import type { Industry, PreviewPreferences, ProductSlug, ProjectType, QuoteDraft } from "@/types";

const initialDraft: QuoteDraft = {
  projectType: "corporate",
  industry: "professional-services",
  mainGoal: "Recibir solicitudes de cotización",
  pages: 5,
  hasLogo: true,
  hasPhotos: false,
  hasTexts: false,
  primaryColor: "#1769ff",
  visualStyle: "Corporativo",
  features: ["WhatsApp", "Formulario"],
  selectedAddons: [],
  businessName: "Tu negocio",
  primaryService: "Servicio principal",
  businessDescription: "Una solución profesional creada para ayudarte a avanzar con confianza.",
  contactName: "",
  email: "",
  phone: "",
  city: "",
  targetDate: "",
};

const goals = ["Recibir mensajes por WhatsApp", "Recibir solicitudes de cotización", "Agendar citas", "Mostrar servicios", "Vender productos", "Captar prospectos", "Mostrar propiedades", "Mostrar menú", "Publicar contenido"];
const features = ["WhatsApp", "Formulario", "Calendario", "Reservaciones", "Blog", "Catálogo", "Pagos", "Usuarios", "Panel administrativo", "Multidioma", "Chat", "CRM", "Automatizaciones", "Correos empresariales"];
const styles = ["Corporativo", "Minimalista", "Elegante", "Tecnológico", "Creativo", "Cálido"];
const colors = ["#1769ff", "#0f766e", "#7c3aed", "#be123c", "#c2410c", "#0f172a", "#ca8a04"];

function recommend(draft: QuoteDraft): ProductSlug {
  if (draft.projectType === "portal" || draft.features.some((feature) => ["Usuarios", "Panel administrativo", "CRM", "Automatizaciones"].includes(feature))) return "medida";
  if (draft.projectType === "ecommerce" || draft.features.includes("Pagos")) return "tienda";
  if (draft.projectType === "landing" || draft.projectType === "campaign") return "esencial";
  return "profesional";
}

export function QuoteConfigurator() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<QuoteDraft>(initialDraft);
  const [selectedProduct, setSelectedProduct] = useState<ProductSlug>("profesional");
  const [productOverride, setProductOverride] = useState(false);
  const [previewPreferences, setPreviewPreferences] = useState<PreviewPreferences>(DEFAULT_PREVIEW_PREFERENCES);
  const [restored, setRestored] = useState(false);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState<"deposit" | "full" | "">("");

  useEffect(() => {
    const restore = window.setTimeout(() => {
      try {
        const session = localStorage.getItem("pd-quote-session-v2");
        if (session) {
          const parsed = JSON.parse(session) as { draft?: Partial<QuoteDraft>; step?: number; selectedProduct?: ProductSlug; productOverride?: boolean; previewPreferences?: Partial<PreviewPreferences>; consent?: boolean };
          if (parsed.draft) setDraft({ ...initialDraft, ...migrateQuoteDraft(parsed.draft) });
          if (typeof parsed.step === "number") setStep(Math.min(5, Math.max(0, parsed.step)));
          if (parsed.selectedProduct && PRODUCTS.some((product) => product.slug === parsed.selectedProduct)) setSelectedProduct(parsed.selectedProduct);
          setProductOverride(Boolean(parsed.productOverride));
          if (parsed.previewPreferences) setPreviewPreferences({ ...DEFAULT_PREVIEW_PREFERENCES, ...parsed.previewPreferences });
          setConsent(Boolean(parsed.consent));
        } else {
          const stored = localStorage.getItem("pd-quote-draft");
          if (stored) setDraft({ ...initialDraft, ...migrateQuoteDraft(JSON.parse(stored) as Partial<QuoteDraft>) });
        }
        const query = new URLSearchParams(window.location.search).get("paquete") as ProductSlug | null;
        if (query && PRODUCTS.some((product) => product.slug === query)) {
          setSelectedProduct(query);
          setProductOverride(true);
        }
      } catch { /* Ignore an invalid local session. */ }
      setRestored(true);
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    if (!restored) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem("pd-quote-draft", JSON.stringify(draft));
        localStorage.setItem("pd-quote-session-v2", JSON.stringify({ version: 2, draft, step, selectedProduct, productOverride, previewPreferences, consent }));
      } catch { /* Storage can be unavailable in private browsing. */ }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draft, step, selectedProduct, productOverride, previewPreferences, consent, restored]);

  useEffect(() => {
    if (step >= 5 || productOverride) return;
    const syncRecommendation = window.setTimeout(() => setSelectedProduct(recommend(draft)), 0);
    return () => window.clearTimeout(syncRecommendation);
  }, [draft, step, productOverride]);

  const quote = useMemo(() => calculateQuote(selectedProduct, draft.selectedAddons), [selectedProduct, draft.selectedAddons]);
  const steps = ["Proyecto", "Objetivo", "Funciones", "Estilo", "Tu negocio", "Propuesta"];

  function update<K extends keyof QuoteDraft>(key: K, value: QuoteDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key === "projectType") trackPreviewEvent("preview_project_type_changed", { projectType: String(value) });
    if (key === "industry") trackPreviewEvent("preview_industry_changed", { industry: String(value) });
    if (key === "visualStyle") trackPreviewEvent("preview_style_changed", { style: String(value) });
  }

  function toggleFeature(value: string) {
    update("features", draft.features.includes(value) ? draft.features.filter((item) => item !== value) : [...draft.features, value]);
  }

  function toggleAddon(value: string) {
    update("selectedAddons", draft.selectedAddons.includes(value) ? draft.selectedAddons.filter((item) => item !== value) : [...draft.selectedAddons, value]);
  }

  function next() {
    if (step === 4 && (!draft.contactName || !draft.email || !consent)) {
      setError("Escribe tu nombre y correo, y acepta el aviso de privacidad para continuar.");
      return;
    }
    setError("");
    if (step === 0) trackPreviewEvent("quote_builder_started");
    if (step === 4) trackPreviewEvent("quote_builder_completed", { projectType: draft.projectType, industry: draft.industry });
    setStep((value) => Math.min(5, value + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveLead() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, selectedProduct, estimatedTotal: quote.total }) });
      if (!response.ok) throw new Error("No pudimos guardar tu solicitud.");
      const data = await response.json() as { saved?: boolean; previewMode?: boolean };
      if (data.previewMode) {
        setError("Vista preliminar: la propuesta se generó correctamente, pero aún no se envía ni se guarda en una base de datos.");
        return;
      }
      setSaved(Boolean(data.saved));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos guardar tu solicitud.");
    } finally { setSaving(false); }
  }

  async function checkout(mode: "deposit" | "full") {
    setCheckoutLoading(mode);
    setError("");
    try {
      if (!saved) await saveLead();
      const response = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productSlug: selectedProduct, addonSlugs: draft.selectedAddons, mode, email: draft.email }) });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "No pudimos iniciar el pago.");
      window.location.href = data.url;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos iniciar el pago.");
      setCheckoutLoading("");
    }
  }

  function reset() {
    setDraft(initialDraft);
    setStep(0);
    setSelectedProduct("profesional");
    setProductOverride(false);
    setPreviewPreferences(DEFAULT_PREVIEW_PREFERENCES);
    setConsent(false);
    setSaved(false);
    setError("");
    setCheckoutLoading("");
    localStorage.removeItem("pd-quote-draft");
    localStorage.removeItem("pd-quote-session-v2");
  }

  return (
    <main className="configurator-shell">
      <header className="configurator-top">
        <Link href="/" className="wordmark"><span className="brand-mark"><i /><i /><i /></span><span><strong>Punto<span>.</span></strong> Digital</span></Link>
        <div className="configurator-progress"><span>Paso {step + 1} de {steps.length}</span><div><i style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div></div>
        <button onClick={reset} className="reset-button"><RotateCcw size={15} /> Reiniciar</button>
      </header>

      <div className="configurator-body">
        <aside className="steps-sidebar">
          <p>Construye tu proyecto</p>
          {steps.map((label, index) => <button type="button" key={label} aria-current={index === step ? "step" : undefined} className={`${index === step ? "is-active" : ""} ${index < step ? "is-done" : ""}`} onClick={() => index < step && setStep(index)}><span>{index < step ? <Check size={14} /> : index + 1}</span>{label}</button>)}
          <div className="draft-status"><CheckCircle2 size={17} /><div><strong>Tu avance se guarda</strong><span>Puedes continuar después en este dispositivo.</span></div></div>
        </aside>

        <section className="configurator-form">
          {step === 0 && <div className="form-step"><div className="form-heading"><span>01 — Tipo de proyecto</span><h1>¿Qué quieres construir?</h1><p>No necesitas conocer términos técnicos. Cada opción activa una estructura de página realmente diferente.</p></div><div className="option-grid option-grid--projects">{PROJECT_TYPES.map(({ slug, label, description }) => <button type="button" key={slug} aria-pressed={draft.projectType === slug} className={draft.projectType === slug ? "is-selected" : ""} onClick={() => update("projectType", slug as ProjectType)}><span className="radio-dot" /><strong>{label}</strong><small>{description}</small></button>)}</div><label className="field"><span>¿A qué industria pertenece tu negocio?</span><select value={draft.industry} onChange={(event) => update("industry", event.target.value as Industry)}>{INDUSTRIES.map((industry) => <option key={industry.slug} value={industry.slug}>{industry.label}</option>)}</select></label></div>}

          {step === 1 && <div className="form-step"><div className="form-heading"><span>02 — Objetivo y contenido</span><h1>¿Qué debe lograr tu página?</h1><p>La mejor estructura comienza con una acción principal muy clara.</p></div><div className="chip-grid">{goals.map((goal) => <button type="button" aria-pressed={draft.mainGoal === goal} className={draft.mainGoal === goal ? "is-selected" : ""} key={goal} onClick={() => update("mainGoal", goal)}>{draft.mainGoal === goal && <Check size={14} />}{goal}</button>)}</div><div className="field-row"><label className="field"><span>Número estimado de páginas</span><input type="number" min="1" max="30" value={draft.pages} onChange={(event) => update("pages", Number(event.target.value))} /></label><div className="check-stack"><label><input type="checkbox" checked={draft.hasLogo} onChange={(event) => update("hasLogo", event.target.checked)} />Ya tengo logotipo</label><label><input type="checkbox" checked={draft.hasPhotos} onChange={(event) => update("hasPhotos", event.target.checked)} />Ya tengo fotografías</label><label><input type="checkbox" checked={draft.hasTexts} onChange={(event) => update("hasTexts", event.target.checked)} />Ya tengo textos</label></div></div></div>}

          {step === 2 && <div className="form-step"><div className="form-heading"><span>03 — Funcionalidades</span><h1>¿Qué necesita hacer?</h1><p>Selecciona todas las funciones importantes. La demostración incorporará tus elecciones.</p></div><div className="feature-grid">{features.map((feature) => <button type="button" aria-pressed={draft.features.includes(feature)} key={feature} className={draft.features.includes(feature) ? "is-selected" : ""} onClick={() => toggleFeature(feature)}><span>{draft.features.includes(feature) && <Check size={14} />}</span>{feature}</button>)}</div><h2 className="subheading">Complementos recomendados</h2><div className="addon-list">{ADDONS.map((addon) => <button type="button" aria-pressed={draft.selectedAddons.includes(addon.slug)} key={addon.slug} className={draft.selectedAddons.includes(addon.slug) ? "is-selected" : ""} onClick={() => toggleAddon(addon.slug)}><span className="check-square">{draft.selectedAddons.includes(addon.slug) && <Check size={14} />}</span><div><strong>{addon.name}</strong><small>{addon.description}</small></div><b>+ {formatMoney(addon.price)}</b></button>)}</div></div>}

          {step === 3 && <div className="form-step"><div className="form-heading"><span>04 — Dirección visual</span><h1>¿Cómo debe sentirse?</h1><p>Esto define una dirección preliminar; el diseño final se crea para tu marca.</p></div><div className="style-grid">{styles.map((style, index) => <button type="button" aria-pressed={draft.visualStyle === style} key={style} className={`${draft.visualStyle === style ? "is-selected" : ""} style-${index + 1}`} onClick={() => update("visualStyle", style)}><span><i /><i /><i /></span><strong>{style}</strong></button>)}</div><label className="field"><span>Color principal</span><div className="color-row">{colors.map((color) => <button type="button" aria-pressed={draft.primaryColor === color} key={color} className={draft.primaryColor === color ? "is-selected" : ""} style={{ backgroundColor: color }} onClick={() => update("primaryColor", color)} aria-label={`Elegir color ${color}`}>{draft.primaryColor === color && <Check size={16} />}</button>)}<input type="color" value={draft.primaryColor} onChange={(event) => update("primaryColor", event.target.value)} aria-label="Elegir un color personalizado" /></div></label></div>}

          {step === 4 && <div className="form-step"><div className="form-heading"><span>05 — Tu negocio</span><h1>Dale nombre a la idea.</h1><p>El nombre, servicio y mensaje se reflejan inmediatamente en tu demostración.</p></div><div className="field-grid"><label className="field"><span>Nombre comercial *</span><input value={draft.businessName} onChange={(event) => update("businessName", event.target.value)} placeholder="Ej. Estudio Norte" /></label><label className="field"><span>Servicio principal</span><input value={draft.primaryService} onChange={(event) => update("primaryService", event.target.value)} placeholder="Ej. Consultoría financiera" /></label><label className="field field--wide"><span>Describe brevemente tu negocio</span><textarea value={draft.businessDescription} onChange={(event) => update("businessDescription", event.target.value)} rows={3} /></label><label className="field"><span>Tu nombre *</span><input value={draft.contactName} onChange={(event) => update("contactName", event.target.value)} /></label><label className="field"><span>Correo *</span><input type="email" value={draft.email} onChange={(event) => update("email", event.target.value)} /></label><label className="field"><span>Teléfono o WhatsApp</span><input value={draft.phone} onChange={(event) => update("phone", event.target.value)} /></label><label className="field"><span>Ciudad</span><input value={draft.city} onChange={(event) => update("city", event.target.value)} /></label><label className="field"><span>Fecha objetivo</span><input type="date" value={draft.targetDate} onChange={(event) => update("targetDate", event.target.value)} /></label></div><label className="consent"><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} /> Acepto el tratamiento de mis datos para recibir esta propuesta. Consulta el <Link href="/aviso-de-privacidad">aviso de privacidad</Link>.</label></div>}

          {step === 5 && <div className="form-step proposal-step"><div className="form-heading"><span>06 — Recomendación</span><h1>Este es tu punto de partida.</h1><p>La estimación se confirma después de revisar el alcance. No es una fecha de entrega definitiva.</p></div><div className="product-selector">{PRODUCTS.map((product) => <button type="button" aria-pressed={selectedProduct === product.slug} key={product.slug} className={selectedProduct === product.slug ? "is-selected" : ""} onClick={() => { setSelectedProduct(product.slug); setProductOverride(true); }}><span>{product.eyebrow}</span><strong>{product.name}</strong><b>{product.price ? formatMoney(product.price) : "A medida"}</b></button>)}</div><div className="quote-summary"><div><span>Paquete base</span><b>{quote.product.price ? formatMoney(quote.base) : "Por definir"}</b></div><div><span>Complementos</span><b>{formatMoney(quote.extras)}</b></div><div className="quote-total"><span>Total estimado</span><b>{quote.product.price ? formatMoney(quote.total) : "Cotización personalizada"}</b></div>{quote.product.price && <div><span>Anticipo sugerido ({quote.product.depositPercentage}%)</span><b>{formatMoney(quote.deposit)}</b></div>}<p><Clock3 size={15} /> Tiempo aproximado: {quote.product.timeline}</p></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="proposal-actions"><button className="button" onClick={saveLead} disabled={saving || saved}>{saving ? <Loader2 className="spin" size={18} /> : saved ? <CheckCircle2 size={18} /> : <Send size={18} />}{saved ? "Propuesta guardada" : "Solicitar propuesta"}</button>{quote.product.price && <><button className="button button--dark" onClick={() => checkout("deposit")} disabled={!!checkoutLoading}>{checkoutLoading === "deposit" ? <Loader2 className="spin" size={18} /> : <CreditCard size={18} />}Pagar anticipo</button><button className="button button--outline" onClick={() => checkout("full")} disabled={!!checkoutLoading}>{checkoutLoading === "full" ? <Loader2 className="spin" size={18} /> : null}Pagar total</button></>}</div></div>}

          {error && step !== 5 && <p className="form-error" role="alert">{error}</p>}
          <div className="form-navigation"><button className="back-button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}><ArrowLeft size={17} /> Anterior</button>{step < 5 && <button className="button" onClick={next}>Continuar <ArrowRight size={17} /></button>}</div>
        </section>

        <LivePreview draft={draft} preferences={previewPreferences} onPreferencesChange={setPreviewPreferences} onApproveDirection={() => setStep((value) => Math.min(5, value + 1))} />
      </div>
    </main>
  );
}
