import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, Bot, BriefcaseBusiness, Check, ChevronRight,
  Gauge, Headphones, Layers3, MessageCircle, MonitorSmartphone, Search,
  ShieldCheck, ShoppingBag, Sparkles, Wrench,
} from "lucide-react";
import { PRODUCTS, formatMoney } from "@/config/products";
import { DigitalOrbit } from "@/components/digital-orbit";
import { BeforeAfter } from "@/components/before-after";
import { ClientShowcase } from "@/components/client-showcase";
import { IndustryDemo } from "@/components/industry-demo";
import { Preloader } from "@/components/preloader";

const signals = [
  [MonitorSmartphone, "Diseño adaptable", "Se ve impecable en cada pantalla"],
  [ShieldCheck, "Hosting y seguridad", "La base técnica queda cubierta"],
  [MessageCircle, "WhatsApp integrado", "El contacto siempre está a un toque"],
  [Search, "Listo para Google", "Estructura preparada para encontrarse"],
  [Headphones, "Soporte continuo", "No te dejamos solo después de publicar"],
] as const;

const services = [
  { icon: Layers3, index: "01", title: "Landing pages", text: "Una oferta, una historia clara y una ruta directa al contacto.", price: "Desde $7,900", className: "service-card--landing", visual: <div className="mini-landing"><span /><b /><i /><i /></div> },
  { icon: BriefcaseBusiness, index: "02", title: "Sitios corporativos", text: "La presencia completa para explicar por qué tu empresa es la elección correcta.", price: "Desde $14,900", className: "service-card--corporate", visual: <div className="mini-corporate"><span /><span /><span /></div> },
  { icon: ShoppingBag, index: "03", title: "Tiendas en línea", text: "Una experiencia de compra confiable, rápida y lista para operar.", price: "Desde $29,900", className: "service-card--shop", visual: <div className="mini-shop"><span /><span /><span /></div> },
  { icon: Bot, index: "04", title: "Portales y sistemas", text: "Reservaciones, usuarios, paneles e integraciones que trabajan contigo.", price: "Cotización", className: "service-card--systems", visual: <div className="mini-system"><i /><i /><i /><i /></div> },
  { icon: Wrench, index: "05", title: "Mantenimiento", text: "Hosting, seguridad, respaldos y mejoras sin carga técnica para ti.", price: "Desde $590/mes", className: "service-card--care", visual: <div className="mini-care"><span><Gauge size={34} /></span><i /></div> },
  { icon: Sparkles, index: "06", title: "Automatizaciones", text: "Conectamos tareas repetitivas para que tu negocio gane tiempo.", price: "A medida", className: "service-card--auto", visual: <div className="mini-auto"><i /><i /><i /><i /><i /></div> },
] as const;

const projects = [
  { name: "Lexora", industry: "Despacho jurídico", goal: "Convertir experiencia en confianza", color: "#172554", accent: "#dbeafe", layout: "project-one" },
  { name: "Nova Dental", industry: "Clínica dental", goal: "Facilitar citas desde cualquier dispositivo", color: "#115e59", accent: "#ccfbf1", layout: "project-two" },
  { name: "Brasa Norte", industry: "Restaurante", goal: "Llevar el ambiente del lugar a la pantalla", color: "#7c2d12", accent: "#ffedd5", layout: "project-three" },
] as const;

const faqs = [
  ["¿Cuánto tarda una página?", "Depende del alcance y de qué tan listo esté el contenido. Como referencia contractual, una landing suele tomar 3 a 5 semanas y un sitio corporativo 5 a 8 semanas después de recibir los materiales."],
  ["¿Qué necesito para comenzar?", "Una idea clara de tu servicio, datos de contacto y disposición para responder el onboarding. Si aún no tienes textos, fotografías o identidad, podemos integrarlos como complementos."],
  ["¿El dominio y el hosting están incluidos?", "Los paquetes Esencial y Profesional incluyen dominio y hosting durante el primer año, sujetos a disponibilidad y alcance. Antes de renovar te explicamos opciones y costos."],
  ["¿La página será mía?", "Sí. La propiedad, accesos y condiciones quedan definidos de forma transparente en la propuesta y el contrato."],
  ["¿Puedo pagar en parcialidades?", "Puedes iniciar con un anticipo del 50%. El saldo se cobra conforme a las condiciones acordadas; nunca se carga automáticamente sin autorización clara."],
  ["¿Pueden rediseñar mi página actual?", "Sí. Primero revisamos qué conviene conservar, qué está frenando resultados y si la mejor ruta es rediseñar o reconstruir."],
] as const;

export function HomePage() {
  return (
    <>
      <Preloader />
      <main id="contenido">
        <section className="hero" id="inicio">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-noise" aria-hidden="true" />
          <div className="hero-content">
            <div className="eyebrow eyebrow--light"><span /> Tu punto de partida digital</div>
            <h1>El punto donde comienza el <em>crecimiento digital</em> de tu negocio.</h1>
            <p>Creamos páginas web profesionales, rápidas y diseñadas para convertir visitas en oportunidades reales.</p>
            <div className="hero-actions">
              <Link href="/cotizador" className="button button--glow">Configurar mi página <ArrowRight size={18} /></Link>
              <Link href="/demo" className="text-link text-link--light"><span>Ver demostraciones</span><ArrowUpRight size={18} /></Link>
            </div>
            <div className="hero-proof"><div className="avatar-dots"><i /><i /><i /></div><p><strong>Diseño · tecnología · estrategia</strong><br />Todo organizado en un solo proceso.</p></div>
          </div>
          <div className="hero-visual"><DigitalOrbit /></div>
          <div className="hero-scroll"><span>Explora</span><i /></div>
        </section>

        <section className="signal-strip" aria-label="Beneficios incluidos">
          {signals.map(([Icon, title, text]) => <div className="signal" key={title}><Icon size={20} /><div><strong>{title}</strong><span>{text}</span></div></div>)}
        </section>

        <section className="section problem-section">
          <div className="section-intro split-intro">
            <div><div className="eyebrow"><span /> El problema</div><h2>Tu negocio puede ser excelente y aun así verse <em>invisible</em> en internet.</h2></div>
            <p>Tener redes sociales no siempre es suficiente. Tus clientes necesitan un lugar claro donde puedan entenderte, compararte y contactarte con confianza.</p>
          </div>
          <div className="problem-grid">
            <div className="problem-list">
              <article><span>01</span><div><h3>Dependes de una plataforma prestada</h3><p>El algoritmo decide cuánto de tu negocio puede ver la gente.</p></div></article>
              <article><span>02</span><div><h3>La información vive dispersa</h3><p>Precios, servicios, ubicación y contacto compiten por atención.</p></div></article>
              <article><span>03</span><div><h3>Compararte se vuelve difícil</h3><p>Sin una presencia propia, la confianza tarda más en aparecer.</p></div></article>
            </div>
            <BeforeAfter />
          </div>
        </section>

        <section className="transformation-section">
          <div className="transformation-copy"><div className="eyebrow eyebrow--light"><span /> La transformación</div><h2>De una buena idea a una presencia que trabaja por ti.</h2><p>Conectamos cada decisión para que el resultado no solo se vea bien: se entienda y mueva al cliente.</p></div>
          <div className="steps-rail">
            {["Negocio", "Identidad", "Diseño", "Publicación", "Oportunidades"].map((item, index) => <div className="rail-step" key={item}><span>0{index + 1}</span><i /><strong>{item}</strong><p>{["Escuchamos lo que haces diferente.", "Traducimos tu esencia a un sistema visual.", "Diseñamos una ruta clara para tu cliente.", "Publicamos una base rápida y segura.", "Medimos y preparamos el siguiente paso."][index]}</p></div>)}
          </div>
        </section>

        <section className="section services-section">
          <div className="section-intro split-intro"><div><div className="eyebrow"><span /> Lo que construimos</div><h2>Una solución para cada <em>punto</em> de tu crecimiento.</h2></div><p>Empieza con lo que necesitas hoy. La arquitectura queda preparada para avanzar contigo.</p></div>
          <div className="services-grid">
            {services.map(({ icon: Icon, index, title, text, price, className, visual }) => (
              <Link href="/cotizador" className={`service-card ${className}`} key={title}>
                <div className="service-top"><span>{index}</span><Icon size={22} /><ArrowUpRight size={18} /></div>
                <div className="service-visual">{visual}</div>
                <div><h3>{title}</h3><p>{text}</p><strong>{price}</strong></div>
              </Link>
            ))}
          </div>
        </section>

        <section className="demo-section" id="demo">
          <div className="section-intro section-intro--center"><div className="eyebrow eyebrow--light"><span /> Pruébalo en tiempo real</div><h2>Una misma estrategia.<br /><em>Una experiencia para cada negocio.</em></h2><p>Selecciona una industria y mira cómo cambia la personalidad, la estructura y el mensaje.</p></div>
          <IndustryDemo />
        </section>

        <section className="section process-section">
          <div className="section-intro split-intro"><div><div className="eyebrow"><span /> Cómo funciona</div><h2>Un proceso claro,<br />de principio a <em>punto.</em></h2></div><Link href="/proceso" className="text-link">Conocer el proceso <ArrowRight size={17} /></Link></div>
          <div className="process-grid">
            {["Conocemos tu negocio", "Reunimos la información", "Diseñamos tu propuesta", "Construimos y revisamos", "Publicamos y acompañamos"].map((title, index) => <article key={title}><div><span>0{index + 1}</span><i /></div><h3>{title}</h3><p>{["Objetivos, clientes y contexto antes de diseñar.", "Te guiamos para reunir textos, imágenes y accesos.", "Definimos la experiencia antes de construirla.", "Avanzamos por etapas con revisiones claras.", "Publicamos, medimos y seguimos cerca."][index]}</p></article>)}
          </div>
        </section>

        <section className="pricing-section" id="paquetes">
          <div className="section-intro section-intro--center"><div className="eyebrow eyebrow--light"><span /> Paquetes</div><h2>Elige tu punto de partida.</h2><p>Precios transparentes, alcance claro y espacio para personalizar.</p></div>
          <div className="pricing-grid">
            {PRODUCTS.map((product) => <article className={`price-card ${product.featured ? "price-card--featured" : ""}`} key={product.slug}>{product.featured && <div className="recommended">Recomendado</div>}<span>{product.eyebrow}</span><h3>{product.name}</h3><p>{product.description}</p><div className="price">{product.price ? <><small>Desde</small><strong>{formatMoney(product.price)}</strong><em>MXN</em></> : <strong>A medida</strong>}</div><ul>{product.features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul><Link href={`/cotizador?paquete=${product.slug}`} className={product.featured ? "button" : "button button--outline"}>Elegir este punto <ChevronRight size={17} /></Link></article>)}
          </div>
          <p className="pricing-note">Los montos son estimaciones iniciales e incluyen IVA solo cuando se indique en la propuesta final. El alcance se confirma antes de pagar.</p>
        </section>

        <section className="section portfolio-section">
          <div className="section-intro split-intro"><div><div className="eyebrow"><span /> Demostraciones conceptuales</div><h2>Diseño que demuestra antes de <em>prometer.</em></h2></div><Link href="/proyectos" className="text-link">Explorar proyectos <ArrowRight size={17} /></Link></div>
          <div className="project-list">
            {projects.map((project, index) => <article className="project-card" key={project.name} style={{ "--project-color": project.color, "--project-accent": project.accent } as React.CSSProperties}><div className={`project-mockup ${project.layout}`}><div className="project-browser"><span /><span /><span /><i /></div><div className="project-nav"><b>{project.name}<i>.</i></b><span /><span /><button /></div><div className="project-body"><div><i /><h3>{project.goal}</h3><p /><p /><button /></div><aside><span /><span /></aside></div></div><div className="project-info"><div><span>0{index + 1}</span><small>Demostración conceptual</small></div><h3>{project.name}</h3><p>{project.industry}</p><Link href="/demo">Explorar demo <ArrowUpRight size={16} /></Link></div></article>)}
          </div>
        </section>

        <section className="difference-section">
          <div className="difference-orb" aria-hidden="true"><span /><span /><span /></div>
          <div><div className="eyebrow eyebrow--light"><span /> La diferencia</div><h2>No entregamos una plantilla. Construimos el <em>punto digital</em> de tu negocio.</h2></div>
          <div className="difference-grid">{["Diseño pensado para tu empresa", "Página impecable en celular", "Tecnología rápida y segura", "Proceso y compra claros", "Acompañamiento real", "Una base que puede crecer"].map((item, index) => <p key={item}><span>0{index + 1}</span>{item}</p>)}</div>
        </section>

        <section className="section faq-section">
          <div className="faq-heading"><div className="eyebrow"><span /> Preguntas frecuentes</div><h2>Lo importante,<br />dicho con <em>claridad.</em></h2><p>¿Tienes otra pregunta?</p><Link href="/contacto">Hablemos de ella <ArrowRight size={16} /></Link></div>
          <div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div>
        </section>

        <ClientShowcase />

        <section className="final-cta">
          <div className="cta-points" aria-hidden="true" />
          <div className="eyebrow eyebrow--light"><span /> Tu siguiente paso</div>
          <h2>Tu próximo punto de<br /><em>crecimiento comienza aquí.</em></h2>
          <p>En menos de cinco minutos puedes definir lo que necesitas, visualizar una dirección y recibir una estimación.</p>
          <div><Link href="/cotizador" className="button button--light">Configurar mi página <ArrowRight size={18} /></Link><Link href="/contacto" className="text-link text-link--light"><MessageCircle size={18} /> Hablar por WhatsApp</Link></div>
        </section>
      </main>
    </>
  );
}
