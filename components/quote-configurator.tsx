"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, CreditCard, Download, Laptop, Loader2, Mail, Palette, RotateCcw, Send, Smartphone, Sparkles } from "lucide-react";
import { ADDONS, PRODUCTS, calculateQuote, formatMoney } from "@/config/products";
import { buildPreview } from "@/lib/preview-engine";
import type { ProductSlug, QuoteDraft } from "@/types";

const initialDraft: QuoteDraft = {
  projectType: "corporativo",
  industry: "Servicios profesionales",
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

const projectTypes = [
  ["landing", "Landing page", "Una oferta enfocada en generar contactos"],
  ["corporativo", "Sitio corporativo", "Una presencia completa para tu empresa"],
  ["tienda", "Tienda en línea", "Catálogo, pagos y operación inicial"],
  ["redesign", "Rediseño", "Mejorar una página que ya existe"],
  ["campaign", "Página para campaña", "Una experiencia temporal y medible"],
  ["system", "Portal o sistema", "Usuarios, flujos e integraciones"],
] as const;

const industries = ["Servicios profesionales", "Despacho jurídico", "Salud y bienestar", "Restaurante", "Construcción", "Inmobiliaria", "Comercio", "Creativo", "Otro"];
const goals = ["Recibir mensajes por WhatsApp", "Recibir solicitudes de cotización", "Agendar citas", "Mostrar servicios", "Vender productos", "Captar prospectos", "Mostrar propiedades", "Mostrar menú", "Publicar contenido"];
const features = ["WhatsApp", "Formulario", "Calendario", "Reservaciones", "Blog", "Catálogo", "Pagos", "Usuarios", "Panel administrativo", "Multidioma", "Chat", "CRM", "Automatizaciones", "Correos empresariales"];
const styles = ["Corporativo", "Minimalista", "Elegante", "Tecnológico", "Creativo", "Cálido"];
const colors = ["#1769ff", "#0f766e", "#7c3aed", "#be123c", "#c2410c", "#0f172a", "#ca8a04"];

function recommend(draft: QuoteDraft): ProductSlug {
  if (draft.projectType === "system" || draft.features.some((feature) => ["Usuarios", "Panel administrativo", "CRM", "Automatizaciones"].includes(feature))) return "medida";
  if (draft.projectType === "tienda" || draft.features.includes("Pagos")) return "tienda";
  if (draft.projectType === "landing" || draft.projectType === "campaign") return "esencial";
  return "profesional";
}

export function QuoteConfigurator() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<QuoteDraft>(initialDraft);
  const [selectedProduct, setSelectedProduct] = useState<ProductSlug>("profesional");
  const [productOverride, setProductOverride] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState<"deposit" | "full" | "">("");

  useEffect(() => {
    const restore = window.setTimeout(() => {
      const stored = localStorage.getItem("pd-quote-draft");
      if (stored) {
        try { setDraft({ ...initialDraft, ...JSON.parse(stored) as QuoteDraft }); } catch { /* Ignore an invalid local draft. */ }
      }
      const query = new URLSearchParams(window.location.search).get("paquete") as ProductSlug | null;
      if (query && PRODUCTS.some((product) => product.slug === query)) {
        setSelectedProduct(query);
        setProductOverride(true);
      }
    }, 0);
    return () => window.clearTimeout(restore);
  }, []);

  useEffect(() => {
    localStorage.setItem("pd-quote-draft", JSON.stringify(draft));
    if (step >= 5 || productOverride) return;
    const syncRecommendation = window.setTimeout(() => setSelectedProduct(recommend(draft)), 0);
    return () => window.clearTimeout(syncRecommendation);
  }, [draft, step, productOverride]);

  const quote = useMemo(() => calculateQuote(selectedProduct, draft.selectedAddons), [selectedProduct, draft.selectedAddons]);
  const theme = useMemo(() => buildPreview(draft), [draft]);
  const steps = ["Proyecto", "Objetivo", "Funciones", "Estilo", "Tu negocio", "Propuesta"];

  function update<K extends keyof QuoteDraft>(key: K, value: QuoteDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleFeature(value: string) {
    update("features", draft.features.includes(value) ? draft.features.filter((item) => item !== value) : [...draft.features, value]);
  }

  function toggleAddon(value: string) {
    update("selectedAddons", draft.selectedAddons.includes(value) ? draft.selectedAddons.filter((item) => item !== value) : [...draft.selectedAddons, value]);
  }

  function next() {
    if (step === 4 && (!draft.contactName || !draft.email)) {
      setError("Escribe tu nombre y correo para guardar la propuesta.");
      return;
    }
    setError("");
    setStep((value) => Math.min(5, value + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveLead() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, selectedProduct, estimatedTotal: quote.total }) });
      if (!response.ok) throw new Error("No pudimos guardar tu solicitud.");
      setSaved(true);
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
    setSaved(false);
    localStorage.removeItem("pd-quote-draft");
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
          {steps.map((label, index) => <button key={label} className={`${index === step ? "is-active" : ""} ${index < step ? "is-done" : ""}`} onClick={() => index < step && setStep(index)}><span>{index < step ? <Check size={14} /> : index + 1}</span>{label}</button>)}
          <div className="draft-status"><CheckCircle2 size={17} /><div><strong>Tu avance se guarda</strong><span>Puedes continuar después en este dispositivo.</span></div></div>
        </aside>

        <section className="configurator-form">
          {step === 0 && <div className="form-step"><div className="form-heading"><span>01 — Tipo de proyecto</span><h1>¿Qué quieres construir?</h1><p>No necesitas conocer términos técnicos. Elige la opción que más se acerca a lo que imaginas.</p></div><div className="option-grid option-grid--projects">{projectTypes.map(([value, label, description]) => <button key={value} className={draft.projectType === value ? "is-selected" : ""} onClick={() => update("projectType", value)}><span className="radio-dot" /><strong>{label}</strong><small>{description}</small></button>)}</div><label className="field"><span>¿A qué industria pertenece tu negocio?</span><select value={draft.industry} onChange={(event) => update("industry", event.target.value)}>{industries.map((industry) => <option key={industry}>{industry}</option>)}</select></label></div>}

          {step === 1 && <div className="form-step"><div className="form-heading"><span>02 — Objetivo y contenido</span><h1>¿Qué debe lograr tu página?</h1><p>La mejor estructura comienza con una acción principal muy clara.</p></div><div className="chip-grid">{goals.map((goal) => <button className={draft.mainGoal === goal ? "is-selected" : ""} key={goal} onClick={() => update("mainGoal", goal)}>{draft.mainGoal === goal && <Check size={14} />}{goal}</button>)}</div><div className="field-row"><label className="field"><span>Número estimado de páginas</span><input type="number" min="1" max="30" value={draft.pages} onChange={(event) => update("pages", Number(event.target.value))} /></label><div className="check-stack"><label><input type="checkbox" checked={draft.hasLogo} onChange={(event) => update("hasLogo", event.target.checked)} />Ya tengo logotipo</label><label><input type="checkbox" checked={draft.hasPhotos} onChange={(event) => update("hasPhotos", event.target.checked)} />Ya tengo fotografías</label><label><input type="checkbox" checked={draft.hasTexts} onChange={(event) => update("hasTexts", event.target.checked)} />Ya tengo textos</label></div></div></div>}

          {step === 2 && <div className="form-step"><div className="form-heading"><span>03 — Funcionalidades</span><h1>¿Qué necesita hacer?</h1><p>Selecciona todas las funciones importantes. Después afinaremos el alcance.</p></div><div className="feature-grid">{features.map((feature) => <button key={feature} className={draft.features.includes(feature) ? "is-selected" : ""} onClick={() => toggleFeature(feature)}><span>{draft.features.includes(feature) && <Check size={14} />}</span>{feature}</button>)}</div><h2 className="subheading">Complementos recomendados</h2><div className="addon-list">{ADDONS.map((addon) => <button key={addon.slug} className={draft.selectedAddons.includes(addon.slug) ? "is-selected" : ""} onClick={() => toggleAddon(addon.slug)}><span className="check-square">{draft.selectedAddons.includes(addon.slug) && <Check size={14} />}</span><div><strong>{addon.name}</strong><small>{addon.description}</small></div><b>+ {formatMoney(addon.price)}</b></button>)}</div></div>}

          {step === 3 && <div className="form-step"><div className="form-heading"><span>04 — Dirección visual</span><h1>¿Cómo debe sentirse?</h1><p>Esto define una dirección preliminar; el diseño final se crea para tu marca.</p></div><div className="style-grid">{styles.map((style, index) => <button key={style} className={`${draft.visualStyle === style ? "is-selected" : ""} style-${index + 1}`} onClick={() => update("visualStyle", style)}><span><i /><i /><i /></span><strong>{style}</strong></button>)}</div><label className="field"><span>Color principal</span><div className="color-row">{colors.map((color) => <button key={color} className={draft.primaryColor === color ? "is-selected" : ""} style={{ backgroundColor: color }} onClick={() => update("primaryColor", color)} aria-label={`Elegir color ${color}`}>{draft.primaryColor === color && <Check size={16} />}</button>)}<input type="color" value={draft.primaryColor} onChange={(event) => update("primaryColor", event.target.value)} aria-label="Elegir un color personalizado" /></div></label></div>}

          {step === 4 && <div className="form-step"><div className="form-heading"><span>05 — Tu negocio</span><h1>Dale nombre a la idea.</h1><p>Usaremos estos datos para crear y guardar tu vista preliminar.</p></div><div className="field-grid"><label className="field"><span>Nombre comercial *</span><input value={draft.businessName} onChange={(event) => update("businessName", event.target.value)} placeholder="Ej. Estudio Norte" /></label><label className="field"><span>Servicio principal</span><input value={draft.primaryService} onChange={(event) => update("primaryService", event.target.value)} placeholder="Ej. Consultoría financiera" /></label><label className="field field--wide"><span>Describe brevemente tu negocio</span><textarea value={draft.businessDescription} onChange={(event) => update("businessDescription", event.target.value)} rows={3} /></label><label className="field"><span>Tu nombre *</span><input value={draft.contactName} onChange={(event) => update("contactName", event.target.value)} /></label><label className="field"><span>Correo *</span><input type="email" value={draft.email} onChange={(event) => update("email", event.target.value)} /></label><label className="field"><span>Teléfono o WhatsApp</span><input value={draft.phone} onChange={(event) => update("phone", event.target.value)} /></label><label className="field"><span>Ciudad</span><input value={draft.city} onChange={(event) => update("city", event.target.value)} /></label><label className="field"><span>Fecha objetivo</span><input type="date" value={draft.targetDate} onChange={(event) => update("targetDate", event.target.value)} /></label></div><label className="consent"><input type="checkbox" required /> Acepto el tratamiento de mis datos para recibir esta propuesta. Consulta el <Link href="/aviso-de-privacidad">aviso de privacidad</Link>.</label></div>}

          {step === 5 && <div className="form-step proposal-step"><div className="form-heading"><span>06 — Recomendación</span><h1>Este es tu punto de partida.</h1><p>La estimación se confirma después de revisar el alcance. No es una fecha de entrega definitiva.</p></div><div className="product-selector">{PRODUCTS.map((product) => <button key={product.slug} className={selectedProduct === product.slug ? "is-selected" : ""} onClick={() => setSelectedProduct(product.slug)}><span>{product.eyebrow}</span><strong>{product.name}</strong><b>{product.price ? formatMoney(product.price) : "A medida"}</b></button>)}</div><div className="quote-summary"><div><span>Paquete base</span><b>{quote.product.price ? formatMoney(quote.base) : "Por definir"}</b></div><div><span>Complementos</span><b>{formatMoney(quote.extras)}</b></div><div className="quote-total"><span>Total estimado</span><b>{quote.product.price ? formatMoney(quote.total) : "Cotización personalizada"}</b></div>{quote.product.price && <div><span>Anticipo sugerido ({quote.product.depositPercentage}%)</span><b>{formatMoney(quote.deposit)}</b></div>}<p><Clock3 size={15} /> Tiempo aproximado: {quote.product.timeline}</p></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="proposal-actions"><button className="button" onClick={saveLead} disabled={saving || saved}>{saving ? <Loader2 className="spin" size={18} /> : saved ? <CheckCircle2 size={18} /> : <Send size={18} />}{saved ? "Propuesta guardada" : "Solicitar propuesta"}</button>{quote.product.price && <><button className="button button--dark" onClick={() => checkout("deposit")} disabled={!!checkoutLoading}>{checkoutLoading === "deposit" ? <Loader2 className="spin" size={18} /> : <CreditCard size={18} />}Pagar anticipo</button><button className="button button--outline" onClick={() => checkout("full")} disabled={!!checkoutLoading}>{checkoutLoading === "full" ? <Loader2 className="spin" size={18} /> : null}Pagar total</button></>}</div></div>}

          {error && step !== 5 && <p className="form-error" role="alert">{error}</p>}
          <div className="form-navigation"><button className="back-button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}><ArrowLeft size={17} /> Anterior</button>{step < 5 && <button className="button" onClick={next}>Continuar <ArrowRight size={17} /></button>}</div>
        </section>

        <aside className="live-preview">
          <div className="preview-toolbar"><div><Sparkles size={16} /><span>Vista preliminar</span></div><div><button className={device === "desktop" ? "is-active" : ""} onClick={() => setDevice("desktop")} aria-label="Vista de escritorio"><Laptop size={16} /></button><button className={device === "mobile" ? "is-active" : ""} onClick={() => setDevice("mobile")} aria-label="Vista móvil"><Smartphone size={16} /></button></div></div>
          <div className={`preview-device preview-device--${device}`} style={{ "--preview-primary": theme.palette.primary, "--preview-secondary": theme.palette.secondary, "--preview-surface": theme.palette.surface, "--preview-text": theme.palette.text, "--preview-heading": theme.typography.heading } as React.CSSProperties}>
            <div className="preview-site">
              <nav><strong>{draft.businessName || "Tu negocio"}<span>.</span></strong><div><i /><i /><button>Contacto</button></div></nav>
              <section className={`preview-hero preview-hero--${theme.heroVariant}`}><div><small>{draft.industry}</small><h2>{draft.primaryService || "Tu servicio principal"}, con una experiencia que inspira confianza.</h2><p>{draft.businessDescription}</p><button>{draft.mainGoal.replace("Recibir ", "").replace("Mostrar ", "Ver ")} <ArrowRight size={12} /></button></div><div className="preview-graphic"><span /><span /><i /></div></section>
              <section className="preview-services"><small>Lo que hacemos</small><div>{["Servicio uno", "Servicio dos", "Servicio tres"].map((item, index) => <article key={item}><span>0{index + 1}</span><strong>{index === 0 ? draft.primaryService : item}</strong><p>Una descripción breve, clara y enfocada en el beneficio.</p></article>)}</div></section>
              <section className="preview-contact"><div><small>Hablemos</small><strong>Tu siguiente paso comienza aquí.</strong></div><button>Contactar</button></section>
            </div>
          </div>
          <p><Palette size={14} /> Esta es una representación preliminar. El diseño final será personalizado.</p>
          <div className="preview-actions"><button disabled title="Disponible en la siguiente versión"><Download size={15} /> Descargar</button><button disabled title="Disponible después de guardar"><Mail size={15} /> Enviar</button></div>
        </aside>
      </div>
    </main>
  );
}
