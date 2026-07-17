"use client";

import {
  Activity, ArrowRight, Bell, CalendarDays, Check, ChevronDown,
  CircleUserRound, Clock3, Heart, LayoutDashboard, MapPin, Menu, MessageCircle,
  Package, Search, ShieldCheck, ShoppingBag, Sparkles, Star, TrendingUp, Users, X, Zap,
} from "lucide-react";
import { INDUSTRY_MAP } from "@/config/preview";
import type { PreviewTemplate, QuoteDraft } from "@/types";

export type PreviewModal = "contact" | "booking" | "product" | "property" | "whatsapp" | null;

export type PreviewInteractionState = {
  activeSection: string;
  mobileMenuOpen: boolean;
  modal: PreviewModal;
  cartCount: number;
  dashboardTab: "Resumen" | "Operación" | "Clientes";
  galleryIndex: number;
  selectedProperty: number;
  toast: string;
};

export type PreviewTemplateProps = {
  draft: QuoteDraft;
  template: PreviewTemplate;
  ui: PreviewInteractionState;
  onNavigate: (section: string) => void;
  onToggleMenu: () => void;
  onModal: (modal: PreviewModal, message?: string) => void;
  onAddToCart: () => void;
  onDashboardTab: (tab: PreviewInteractionState["dashboardTab"]) => void;
  onGalleryChange: (index: number) => void;
  onPropertyChange: (index: number) => void;
};

const genericDescription = "Una solución profesional creada para ayudarte a avanzar con confianza.";

function getCopy(draft: QuoteDraft) {
  const industry = INDUSTRY_MAP[draft.industry];
  const goalCta: Record<string, string> = {
    "Recibir mensajes por WhatsApp": "Hablar por WhatsApp",
    "Recibir solicitudes de cotización": draft.industry === "construction" ? "Solicitar cotización" : industry.primaryCta,
    "Agendar citas": ["medical", "dental", "beauty"].includes(draft.industry) ? industry.primaryCta : "Agendar una llamada",
    "Mostrar servicios": industry.secondaryCta,
    "Vender productos": "Comprar ahora",
    "Captar prospectos": "Recibir información",
    "Mostrar propiedades": "Explorar propiedades",
    "Mostrar menú": "Explorar menú",
    "Publicar contenido": "Explorar contenido",
  };
  return {
    ...industry,
    eyrow: industry.eyebrow,
    primaryCta: goalCta[draft.mainGoal] ?? industry.primaryCta,
    businessName: draft.businessName.trim() || "Tu negocio",
    primaryService: draft.primaryService.trim() && draft.primaryService !== "Servicio principal" ? draft.primaryService : industry.services[0],
    description: draft.businessDescription?.trim() && draft.businessDescription !== genericDescription ? draft.businessDescription : industry.description,
  };
}

function Brand({ name }: { name: string }) {
  const words = name.split(" ");
  return <strong className="pv-brand"><span>{words[0]}</span>{words.length > 1 ? ` ${words.slice(1).join(" ")}` : ""}<i>.</i></strong>;
}

function PreviewNavigation({ draft, template, ui, onNavigate, onToggleMenu, onModal }: PreviewTemplateProps) {
  const copy = getCopy(draft);
  const labels = template.navigationVariant === "minimal" ? ["Beneficios", "Experiencia"] : template.navigationVariant === "editorial" ? ["Proyectos", "Estudio", "Proceso"] : ["Inicio", "Servicios", "Experiencia", "Contacto"];
  return (
    <nav className={`pv-nav pv-nav--${template.navigationVariant}`} aria-label="Navegación de la demostración">
      <Brand name={copy.businessName} />
      <div className={`pv-nav__links ${ui.mobileMenuOpen ? "is-open" : ""}`}>
        {labels.map((label) => <button type="button" key={label} className={ui.activeSection === label ? "is-active" : ""} onClick={() => onNavigate(label)}>{label}</button>)}
      </div>
      <button type="button" className="pv-nav__cta" onClick={() => onModal("contact", "Abrimos el formulario de contacto.")}>{copy.primaryCta}</button>
      <button type="button" className="pv-nav__menu" onClick={onToggleMenu} aria-label={ui.mobileMenuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={ui.mobileMenuOpen}>{ui.mobileMenuOpen ? <X size={14} /> : <Menu size={14} />}</button>
    </nav>
  );
}

function IndustryVisual({ draft, ui, onGalleryChange }: Pick<PreviewTemplateProps, "draft" | "ui" | "onGalleryChange">) {
  const copy = getCopy(draft);
  return (
    <div className={`pv-industry-visual pv-industry-visual--${copy.module}`}>
      <div className="pv-visual-grid" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="pv-visual-main" aria-hidden="true"><span /><span /><i /></div>
      <div className="pv-visual-card"><span>{copy.eyebrow}</span><strong>{copy.trustItems[0]}</strong><small>{copy.trustItems[1]}</small></div>
      {(copy.module === "booking-gallery" || copy.module === "smile-gallery" || copy.module === "editorial-portfolio") && <div className="pv-gallery-dots" aria-label="Cambiar imagen de galería">{[0, 1, 2].map((index) => <button type="button" key={index} aria-label={`Imagen ${index + 1}`} aria-pressed={ui.galleryIndex === index} className={ui.galleryIndex === index ? "is-active" : ""} onClick={() => onGalleryChange(index)} />)}</div>}
    </div>
  );
}

function TrustStrip({ draft }: { draft: QuoteDraft }) {
  const copy = getCopy(draft);
  const icons = [ShieldCheck, Clock3, Star];
  return <section className="pv-trust">{copy.trustItems.map((item, index) => { const Icon = icons[index]; return <div key={item}><Icon size={13} /><span>{item}</span></div>; })}</section>;
}

function Services({ draft, onModal }: Pick<PreviewTemplateProps, "draft" | "onModal">) {
  const copy = getCopy(draft);
  return (
    <section className="pv-section pv-services">
      <div className="pv-section-heading"><div><small>Lo que hacemos</small><h3>Soluciones pensadas para tu siguiente paso.</h3></div><button type="button" onClick={() => onModal("contact", "Mostramos los detalles del servicio.")}>Ver todos <ArrowRight size={11} /></button></div>
      <div className="pv-service-grid">{copy.services.map((service, index) => <button type="button" key={service} onClick={() => onModal("contact", `${service}: abrimos su detalle conceptual.`)}><span>0{index + 1}</span><i>{[Sparkles, TrendingUp, Users].map((Icon, iconIndex) => iconIndex === index ? <Icon key={service} size={16} /> : null)}</i><strong>{index === 0 ? copy.primaryService : service}</strong><small>Una solución clara, profesional y enfocada en resultados.</small><b>Conocer más <ArrowRight size={9} /></b></button>)}</div>
    </section>
  );
}

function IndustryModule({ draft, ui, onModal, onPropertyChange }: Pick<PreviewTemplateProps, "draft" | "ui" | "onModal" | "onPropertyChange">) {
  const copy = getCopy(draft);
  if (copy.module === "property-search") {
    const properties = [
      ["Casa Sierra", "$6.8 M", "Valle Norte"], ["Residencia Loma", "$8.4 M", "Bosques"], ["Loft Central", "$3.2 M", "Distrito Uno"],
    ];
    return <section className="pv-industry-module pv-property-module"><div className="pv-property-search"><span><MapPin size={10} /> Ubicación</span><span>Tipo de propiedad <ChevronDown size={9} /></span><button type="button"><Search size={10} /> Buscar</button></div><div className="pv-property-list">{properties.map(([name, price, place], index) => <button type="button" key={name} className={ui.selectedProperty === index ? "is-selected" : ""} onClick={() => onPropertyChange(index)}><i /><span><small>{place}</small><strong>{name}</strong><b>{price}</b></span></button>)}</div><button type="button" className="pv-module-action" onClick={() => onModal("property", "Preparamos una visita conceptual.")}>Agendar visita <ArrowRight size={10} /></button></section>;
  }
  if (copy.module === "menu") {
    return <section className="pv-industry-module pv-menu-module"><div><small>Selección del chef</small><h3>Sabores que cuentan nuestra historia.</h3></div><div>{["Entrada de temporada", "Especialidad de la casa", "Postre artesanal"].map((item, index) => <button type="button" key={item} onClick={() => onModal("booking", "Añadimos tu selección a la reservación.")}><i /><span><strong>{item}</strong><small>{["Texturas frescas y cítricos", "Fuego lento, producto local", "Dulce, cremoso y ligero"][index]}</small></span><b>${[180, 360, 150][index]}</b></button>)}</div></section>;
  }
  if (copy.module === "appointment" || copy.module === "smile-gallery" || copy.module === "booking-gallery") {
    return <section className="pv-industry-module pv-booking-module"><div><CalendarDays size={18} /><span><small>Próximo espacio disponible</small><strong>Hoy · 4:30 PM</strong></span></div><div className="pv-booking-days">{["Lun 20", "Mar 21", "Mié 22"].map((day, index) => <button type="button" key={day} className={index === 1 ? "is-selected" : ""}>{day}</button>)}</div><button type="button" onClick={() => onModal("booking", "Abrimos la agenda de demostración.")}>{copy.primaryCta}</button></section>;
  }
  if (copy.module === "membership") {
    return <section className="pv-industry-module pv-membership-module"><div><small>Empieza hoy</small><strong>7 días para descubrir tu ritmo.</strong><span>Acceso a clases · Evaluación · Comunidad</span></div><button type="button" onClick={() => onModal("booking", "Tu prueba gratuita está lista para configurar.")}>Activar prueba <Zap size={11} /></button></section>;
  }
  if (copy.module === "programs") {
    return <section className="pv-industry-module pv-program-module">{["Programa esencial", "Especialización", "Sesión abierta"].map((item, index) => <button type="button" key={item} onClick={() => onModal("contact", "Abrimos el programa de demostración.")}><span>0{index + 1}</span><strong>{item}</strong><small>{["8 módulos", "Certificado", "Próxima fecha"][index]}</small><ArrowRight size={10} /></button>)}</section>;
  }
  if (copy.module === "integrations") {
    return <section className="pv-industry-module pv-integration-module"><div><span>CRM</span><span>API</span><span>DATA</span><span>AI</span></div><strong>Todo conectado en un flujo inteligente.</strong><button type="button" onClick={() => onModal("contact", "Mostramos el mapa de integraciones.")}>Explorar integraciones</button></section>;
  }
  return <section className="pv-industry-module pv-authority-module"><div><span>01</span><strong>Diagnóstico claro</strong></div><div><span>02</span><strong>Ruta personalizada</strong></div><div><span>03</span><strong>Acompañamiento</strong></div></section>;
}

function SiteFooter({ draft, template, onModal }: Pick<PreviewTemplateProps, "draft" | "template" | "onModal">) {
  const copy = getCopy(draft);
  return (
    <footer className={`pv-footer pv-footer--${template.footerVariant}`}>
      <div><Brand name={copy.businessName} /><small>Una demostración conceptual creada para visualizar tu dirección.</small></div>
      <div><span>Inicio</span><span>Servicios</span><span>Contacto</span></div>
      <div className="pv-footer__features"><small>Funciones seleccionadas</small>{draft.features.slice(0, 3).map((feature) => <span key={feature}><Check size={8} /> {feature}</span>)}</div>
      <div><small>Tu siguiente paso</small><button type="button" onClick={() => onModal("whatsapp", "Abrimos una conversación simulada.")}><MessageCircle size={11} /> Hablar por WhatsApp</button></div>
      <p>© {new Date().getFullYear()} {copy.businessName} · Aviso de privacidad</p>
    </footer>
  );
}

function PreviewActionModal({ draft, ui, onModal }: Pick<PreviewTemplateProps, "draft" | "ui" | "onModal">) {
  const copy = getCopy(draft);
  if (!ui.modal) return null;
  const title = ui.modal === "product" ? "Producto agregado" : ui.modal === "property" ? "Agenda una visita" : ui.modal === "booking" ? copy.primaryCta : ui.modal === "whatsapp" ? "WhatsApp" : "Hablemos de tu proyecto";
  return <div className="pv-modal-backdrop" role="presentation" onMouseDown={() => onModal(null)}><section className="pv-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="pv-modal__close" aria-label="Cerrar" onClick={() => onModal(null)}><X size={13} /></button><span className="pv-modal__icon">{ui.modal === "whatsapp" ? <MessageCircle size={17} /> : <Sparkles size={17} />}</span><small>Demostración interactiva</small><h3>{title}</h3><p>{ui.modal === "whatsapp" ? `Hola, ${copy.businessName}. Me interesa conocer más sobre ${copy.primaryService}.` : "Así se sentiría una interacción real dentro de tu futuro sitio."}</p>{ui.modal !== "product" && <div className="pv-modal__fields"><label><span>Nombre</span><input tabIndex={0} placeholder="Tu nombre" /></label><label><span>Mensaje</span><input tabIndex={0} placeholder="¿Cómo podemos ayudarte?" /></label></div>}<button type="button" className="pv-modal__submit" onClick={() => onModal(null, "Interacción demostrada correctamente.")}>{ui.modal === "whatsapp" ? "Simular envío" : "Continuar"} <ArrowRight size={10} /></button></section></div>;
}

export function CorporatePreview(props: PreviewTemplateProps) {
  const { draft, template, onModal } = props;
  const copy = getCopy(draft);
  return <div className="pv-page pv-page--corporate"><PreviewNavigation {...props} /><main><section className="pv-corporate-hero"><div className="pv-hero-copy"><span className="pv-kicker"><i /> {copy.eyebrow}</span><h1>{copy.headline}</h1><p>{copy.description}</p><div><button type="button" onClick={() => onModal("contact", "Abrimos el formulario de asesoría.")}>{copy.primaryCta} <ArrowRight size={11} /></button><button type="button" onClick={() => props.onNavigate("Servicios")}>{copy.secondaryCta}</button></div><small><Check size={10} /> Respuesta inicial sin compromiso</small></div><IndustryVisual draft={draft} ui={props.ui} onGalleryChange={props.onGalleryChange} /></section><TrustStrip draft={draft} /><Services draft={draft} onModal={onModal} /><IndustryModule draft={draft} ui={props.ui} onModal={onModal} onPropertyChange={props.onPropertyChange} /><section className="pv-authority"><div><small>Una relación basada en confianza</small><h3>Experiencia que se convierte en decisiones accionables.</h3></div><div>{["Escuchamos", "Diseñamos", "Acompañamos"].map((item, index) => <span key={item}><b>0{index + 1}</b>{item}</span>)}</div></section><section className="pv-testimonial"><div className="pv-avatar-stack"><i /><i /><i /></div><blockquote>“Una experiencia clara, cuidada y profesional desde el primer contacto.”</blockquote><span>Testimonio conceptual · Dirección visual</span></section></main><SiteFooter draft={draft} template={template} onModal={onModal} /><PreviewActionModal draft={draft} ui={props.ui} onModal={onModal} /></div>;
}

export function LandingPreview(props: PreviewTemplateProps) {
  const { draft, template, onModal } = props;
  const copy = getCopy(draft);
  return <div className="pv-page pv-page--landing"><div className="pv-landing-promo"><Sparkles size={10} /> Atención personalizada para tu proyecto <span>Respuesta ágil</span></div><PreviewNavigation {...props} /><main><section className="pv-landing-hero"><div><span className="pv-kicker"><i /> {copy.eyrow ?? copy.eyebrow}</span><h1>{copy.headline}</h1><p>{copy.description}</p><div className="pv-landing-benefits">{copy.trustItems.map((item) => <span key={item}><Check size={10} /> {item}</span>)}</div><button type="button" onClick={() => onModal("whatsapp", "Abrimos una conversación simulada.")}>{copy.primaryCta} <ArrowRight size={11} /></button></div><form className={`pv-lead-form form-${template.formVariant}`} onSubmit={(event) => event.preventDefault()}><small>Da el primer paso</small><strong>Recibe una orientación inicial.</strong><label><span>Tu nombre</span><input aria-label="Nombre en la demostración" placeholder="Nombre" /></label><label><span>¿Qué necesitas?</span><select aria-label="Servicio en la demostración" defaultValue={copy.primaryService}><option>{copy.primaryService}</option><option>Información general</option></select></label><button type="button" onClick={() => onModal("contact", "El formulario está listo para convertir visitas.")}>{copy.primaryCta}</button><p><ShieldCheck size={9} /> Tus datos se usarían solo para responderte.</p></form></section><TrustStrip draft={draft} /><section className="pv-benefit-story"><div><small>Por qué elegirnos</small><h3>Una sola página. Una acción clara. Cero fricción.</h3></div><div>{copy.services.map((item, index) => <article key={item}><span>0{index + 1}</span><strong>{item}</strong><small>Beneficio explicado de forma breve y convincente.</small></article>)}</div></section><IndustryModule draft={draft} ui={props.ui} onModal={onModal} onPropertyChange={props.onPropertyChange} /><section className="pv-landing-cta"><div className="pv-avatar-stack"><i /><i /><i /></div><div><strong>Tu siguiente paso está a un clic.</strong><span>Experiencia conceptual adaptable a tu marca.</span></div><button type="button" onClick={() => onModal("contact")}>{copy.primaryCta}</button></section></main><SiteFooter draft={draft} template={template} onModal={onModal} /><PreviewActionModal draft={draft} ui={props.ui} onModal={onModal} /></div>;
}

export function EcommercePreview(props: PreviewTemplateProps) {
  const { draft, template, ui, onAddToCart, onModal } = props;
  const copy = getCopy(draft);
  const products = copy.module === "property-search" ? [["Casa Sierra", "$6.8 M"], ["Residencia Loma", "$8.4 M"], ["Loft Central", "$3.2 M"], ["Casa Jardín", "$5.1 M"]] : [["Selección esencial", "$890"], ["Edición especial", "$1,290"], ["Favorito de temporada", "$720"], ["Colección premium", "$1,680"]];
  return <div className="pv-page pv-page--shop"><div className="pv-shop-promo">Envío o atención inicial incluidos <span>Oferta conceptual</span></div><header className="pv-shop-nav"><Brand name={copy.businessName} /><div className="pv-shop-search"><Search size={11} /><span>Buscar productos</span></div><button type="button" aria-label="Abrir cuenta"><CircleUserRound size={14} /></button><button type="button" className="pv-cart-button" aria-label={`Carrito con ${ui.cartCount} productos`} onClick={() => onModal("product")}><ShoppingBag size={14} /><b>{ui.cartCount}</b></button></header><div className="pv-shop-categories">{["Novedades", copy.services[0], copy.services[1], "Promociones"].map((item, index) => <button type="button" key={item} className={index === 0 ? "is-active" : ""}>{item}</button>)}</div><main><section className="pv-shop-hero"><div><small>{copy.eyebrow}</small><h1>{copy.headline}</h1><p>{copy.description}</p><button type="button" onClick={() => props.onNavigate("Productos")}>Comprar ahora <ArrowRight size={11} /></button></div><div className="pv-shop-feature"><span>Selección destacada</span><i /><strong>{copy.primaryService}</strong><b>Ver colección</b></div></section><section className={`pv-products products-${template.productVariant}`}><div className="pv-section-heading"><div><small>Catálogo</small><h3>Elegidos para ti.</h3></div><button type="button">Ver todo <ArrowRight size={10} /></button></div><div className="pv-product-grid">{products.map(([name, price], index) => <article key={name}><button type="button" className="pv-product-heart" aria-label={`Guardar ${name}`}><Heart size={11} /></button><div className={`pv-product-image pv-product-image--${index + 1}`}><span>Nuevo</span><i /></div><small>{copy.label}</small><strong>{name}</strong><div><b>{price}</b><button type="button" onClick={onAddToCart} aria-label={`Agregar ${name} al carrito`}><ShoppingBag size={10} /></button></div></article>)}</div></section><section className="pv-shop-confidence">{[[ShieldCheck, "Compra segura"], [Package, "Entrega confiable"], [MessageCircle, "Atención directa"]].map(([Icon, label]) => { const ItemIcon = Icon as typeof ShieldCheck; return <span key={String(label)}><ItemIcon size={13} />{String(label)}</span>; })}</section></main><SiteFooter draft={draft} template={template} onModal={onModal} /><PreviewActionModal draft={draft} ui={ui} onModal={onModal} /></div>;
}

export function RedesignPreview(props: PreviewTemplateProps) {
  const { draft, template, onModal } = props;
  const copy = getCopy(draft);
  return <div className="pv-page pv-page--redesign"><PreviewNavigation {...props} /><main><section className="pv-redesign-hero"><div><span className="pv-kicker"><i /> Rediseño estratégico</span><h1>De una página que solo existe a una experiencia que sí trabaja.</h1><p>Mejor jerarquía, navegación, velocidad percibida y rutas claras para convertir.</p><button type="button" onClick={() => onModal("contact")}>Evaluar mi página <ArrowRight size={11} /></button></div><div className="pv-redesign-score"><span>Experiencia conceptual</span><div><b>92</b><small>/100</small></div><p><i /> Claridad <strong>Excelente</strong></p><p><i /> Adaptación móvil <strong>Lista</strong></p><p><i /> Conversión <strong>Optimizada</strong></p></div></section><section className="pv-redesign-compare"><article className="is-before"><header><i /><i /><i /></header><div><span /><b>mi_negocio_web</b><p /><p /><button /></div><small>ANTES</small></article><div className="pv-redesign-arrow"><ArrowRight size={14} /></div><article className="is-after"><header><Brand name={copy.businessName} /><span /><span /></header><div><small>{copy.eyebrow}</small><strong>{copy.headline}</strong><p>{copy.description}</p><button>{copy.primaryCta}</button></div><small>DESPUÉS</small></article></section><section className="pv-redesign-improvements">{[[TrendingUp, "Jerarquía que guía"], [SmartphoneIcon, "Móvil de verdad"], [Zap, "Carga perceptualmente rápida"], [MessageCircle, "CTA visible"]].map(([Icon, label]) => { const ItemIcon = Icon as typeof TrendingUp; return <article key={String(label)}><ItemIcon size={15} /><strong>{String(label)}</strong><small>Mejora conceptual representada visualmente.</small></article>; })}</section><section className="pv-redesign-new"><div><small>Nueva dirección</small><h3>{copy.headline}</h3><p>{copy.description}</p><button type="button" onClick={() => onModal("contact")}>{copy.primaryCta}</button></div><IndustryVisual draft={draft} ui={props.ui} onGalleryChange={props.onGalleryChange} /></section></main><SiteFooter draft={draft} template={template} onModal={onModal} /><PreviewActionModal draft={draft} ui={props.ui} onModal={onModal} /></div>;
}

function SmartphoneIcon({ size = 15 }: { size?: number }) { return <span className="pv-phone-icon" style={{ width: size * .7, height: size }} />; }

export function CampaignPreview(props: PreviewTemplateProps) {
  const { draft, template, onModal } = props;
  const copy = getCopy(draft);
  return <div className="pv-page pv-page--campaign"><header className="pv-campaign-nav"><Brand name={copy.businessName} /><span>Campaña vigente · Cupo limitado</span><button type="button" onClick={() => onModal("whatsapp")}>Resolver una duda</button></header><main><section className="pv-campaign-hero"><div className="pv-campaign-badge"><Sparkles size={11} /> Experiencia especial</div><h1>{copy.headline}</h1><p>{copy.description}</p><div className="pv-countdown" aria-label="Cuenta regresiva conceptual">{[["03", "Días"], ["18", "Horas"], ["42", "Min"]].map(([value, label]) => <span key={label}><b>{value}</b><small>{label}</small></span>)}</div><div className="pv-campaign-actions"><button type="button" onClick={() => onModal("booking")}>{copy.primaryCta} <ArrowRight size={11} /></button><span>Vigencia conceptual</span></div></section><section className="pv-campaign-offer"><div><small>Beneficio principal</small><h3>{copy.primaryService}</h3><p>Una propuesta directa, fácil de entender y diseñada para provocar acción.</p><div>{copy.trustItems.map((item) => <span key={item}><Check size={9} />{item}</span>)}</div></div><form onSubmit={(event) => event.preventDefault()}><span>Acceso preferente</span><strong>Recibe los detalles.</strong><input aria-label="Nombre" placeholder="Nombre" /><input aria-label="Correo" placeholder="Correo" /><button type="button" onClick={() => onModal("contact", "Formulario conceptual completado.")}>Quiero aprovecharlo</button><small>Código: <b>PUNTO20</b></small></form></section><section className="pv-campaign-metrics"><span><b>01</b>Una oferta</span><span><b>02</b>Un mensaje</span><span><b>03</b>Una acción</span><small>Métricas conceptuales</small></section></main><SiteFooter draft={draft} template={template} onModal={onModal} /><PreviewActionModal draft={draft} ui={props.ui} onModal={onModal} /></div>;
}

export function PortalPreview(props: PreviewTemplateProps) {
  const { draft, template, ui, onDashboardTab, onModal } = props;
  const copy = getCopy(draft);
  return <div className={`pv-page pv-page--portal dashboard-${template.dashboardVariant}`}><aside className="pv-portal-sidebar"><Brand name={copy.businessName} /><nav>{[[LayoutDashboard, "Resumen"], [Activity, "Actividad"], [Users, "Clientes"], [Package, "Proyectos"]].map(([Icon, label], index) => { const ItemIcon = Icon as typeof LayoutDashboard; return <button type="button" key={String(label)} className={index === 0 ? "is-active" : ""} onClick={() => props.onNavigate(String(label))}><ItemIcon size={13} /><span>{String(label)}</span></button>; })}</nav><div><Sparkles size={14} /><span><small>Plan activo</small><strong>Business</strong></span></div><button type="button" className="pv-portal-user"><i /> <span>Equipo demo<small>Administrador</small></span></button></aside><main className="pv-portal-main"><header><div><small>Panel de control</small><h1>Hola, {copy.businessName}.</h1></div><div><button type="button" aria-label="Notificaciones" onClick={() => onModal("contact", "Mostramos tus notificaciones.")}><Bell size={14} /><i /></button><button type="button" onClick={() => onModal("contact")}>+ Nueva tarea</button></div></header><div className="pv-dashboard-tabs" role="tablist" aria-label="Vista del dashboard">{(["Resumen", "Operación", "Clientes"] as const).map((tab) => <button type="button" role="tab" aria-selected={ui.dashboardTab === tab} className={ui.dashboardTab === tab ? "is-active" : ""} key={tab} onClick={() => onDashboardTab(tab)}>{tab}</button>)}</div><section className="pv-metric-grid">{[["Oportunidades", "24", "+18%"], ["Tareas activas", "08", "3 hoy"], ["Conversión", "32%", "+4.2%"], ["Integraciones", "06", "Activas"]].map(([label, value, change], index) => <article key={label}><span><small>{label}</small>{[TrendingUp, Check, Activity, Zap].map((Icon, iconIndex) => iconIndex === index ? <Icon key={label} size={12} /> : null)}</span><strong>{ui.dashboardTab === "Clientes" && index === 0 ? "148" : value}</strong><small>{change}</small></article>)}</section><section className="pv-dashboard-grid"><article className="pv-chart-card"><div><span><small>Rendimiento</small><strong>{ui.dashboardTab}</strong></span><button type="button">Últimos 30 días <ChevronDown size={8} /></button></div><div className="pv-chart"><span /><span /><span /><span /><span /><i /><i /><i /><i /><i /><i /><i /></div><footer><span><i />Este periodo</span><span><i />Periodo anterior</span></footer></article><article className="pv-activity-card"><div><small>Actividad reciente</small><button type="button">Ver todo</button></div>{["Nueva solicitud recibida", "Tarea completada", "Integración actualizada"].map((item, index) => <p key={item}><i>{[MessageCircle, Check, Zap].map((Icon, iconIndex) => iconIndex === index ? <Icon key={item} size={10} /> : null)}</i><span><strong>{item}</strong><small>Hace {index + 1} h</small></span></p>)}</article></section><section className="pv-portal-table"><header><strong>Flujo de proyectos</strong><button type="button">Filtrar <ChevronDown size={8} /></button></header>{["Implementación Norte", "Portal Clientes", "Automatización CRM"].map((item, index) => <div key={item}><span><i />{item}</span><span>{["En progreso", "Revisión", "Planeación"][index]}</span><span>{["Hoy", "Mañana", "24 Jul"][index]}</span><b style={{ "--progress": `${[78, 54, 25][index]}%` } as React.CSSProperties} /></div>)}</section></main><PreviewActionModal draft={draft} ui={ui} onModal={onModal} /></div>;
}

export function PreviewTemplateRenderer(props: PreviewTemplateProps) {
  switch (props.template.projectType) {
    case "landing": return <LandingPreview {...props} />;
    case "ecommerce": return <EcommercePreview {...props} />;
    case "redesign": return <RedesignPreview {...props} />;
    case "campaign": return <CampaignPreview {...props} />;
    case "portal": return <PortalPreview {...props} />;
    default: return <CorporatePreview {...props} />;
  }
}
