import { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { PRODUCTS, formatMoney } from "@/config/products";
import { ContactForm } from "@/components/contact-form";

type PageData = {
  eyebrow: string;
  title: string;
  description: string;
  bullets?: string[];
  legal?: boolean;
  contact?: boolean;
};

const serviceData: Record<string, PageData> = {
  "landing-pages": {
    eyebrow: "Landing pages",
    title: "Una página enfocada en una sola decisión.",
    description:
      "Presenta tu oferta con claridad y lleva cada visita hacia el contacto, la cita o la compra.",
    bullets: [
      "Estrategia de conversión",
      "Hasta 6 secciones",
      "WhatsApp y formulario",
      "SEO inicial",
      "Responsive y rápida",
    ],
  },
  "sitios-corporativos": {
    eyebrow: "Sitios corporativos",
    title: "Una presencia completa para una empresa que quiere avanzar.",
    description:
      "Organizamos servicios, experiencia y argumentos para que tus clientes puedan elegirte con confianza.",
    bullets: [
      "Arquitectura de contenido",
      "Diseño personalizado",
      "Secciones por servicio",
      "Analytics",
      "SEO técnico",
    ],
  },
  "tiendas-en-linea": {
    eyebrow: "Tiendas en línea",
    title: "Una experiencia de compra lista para operar.",
    description:
      "Catálogo, carrito, pagos y correos transaccionales reunidos en una tienda clara y confiable.",
    bullets: [
      "Catálogo e inventario inicial",
      "Checkout y pagos",
      "Cupones",
      "Envíos",
      "Capacitación",
    ],
  },
  "sistemas-web": {
    eyebrow: "Sistemas web",
    title: "Herramientas digitales que se adaptan a tu operación.",
    description:
      "Portales, usuarios, reservaciones, paneles e integraciones construidos alrededor del flujo real de tu negocio.",
    bullets: [
      "Diagnóstico funcional",
      "Flujos y permisos",
      "Panel administrativo",
      "Integraciones",
      "Arquitectura escalable",
    ],
  },
  mantenimiento: {
    eyebrow: "Mantenimiento",
    title: "Tu página cuidada, segura y al día.",
    description:
      "Nos ocupamos de hosting, respaldos, monitoreo y mejoras para que tú puedas ocuparte de tu negocio.",
    bullets: [
      "SSL y monitoreo",
      "Respaldos",
      "Soporte técnico",
      "Ajustes mensuales según plan",
      "Reportes",
    ],
  },
};

const pageData: Record<string, PageData> = {
  servicios: {
    eyebrow: "Servicios",
    title: "Diseño, tecnología y acompañamiento en un solo punto.",
    description:
      "Creamos desde páginas enfocadas hasta sistemas a la medida, siempre con una ruta comercial clara.",
    bullets: [
      "Landing pages",
      "Sitios corporativos",
      "Tiendas en línea",
      "Portales y sistemas",
      "Mantenimiento",
      "Automatizaciones",
    ],
  },
  paquetes: {
    eyebrow: "Paquetes",
    title: "Un punto de partida claro para cada etapa.",
    description:
      "Compara alcance, inversión y tiempos aproximados antes de configurar tu proyecto.",
  },
  proyectos: {
    eyebrow: "Proyectos conceptuales",
    title: "Así puede sentirse un negocio cuando su página tiene intención.",
    description:
      "Explora direcciones creadas para distintos sectores. Cada ejemplo está identificado como demostración conceptual.",
    bullets: [
      "Lexora — despacho jurídico",
      "Nova Dental — clínica dental",
      "Brasa Norte — restaurante",
      "Arista — constructora",
      "Habita — inmobiliaria",
      "Áurea — belleza",
    ],
  },
  proceso: {
    eyebrow: "Cómo funciona",
    title: "Un proceso claro reduce la incertidumbre y mejora el resultado.",
    description:
      "Conocemos tu negocio, reunimos información, diseñamos, construimos, revisamos y publicamos contigo.",
    bullets: [
      "1. Conocemos tu negocio",
      "2. Reunimos la información",
      "3. Diseñamos tu propuesta",
      "4. Construimos y revisamos",
      "5. Publicamos y acompañamos",
    ],
  },
  nosotros: {
    eyebrow: "Punto Digital",
    title: "Hacemos que los buenos negocios se vean tan profesionales como realmente son.",
    description:
      "Punto Digital une estrategia, diseño y tecnología para crear presencias claras, útiles y preparadas para crecer.",
    bullets: [
      "Claridad antes que jerga",
      "Diseño antes que plantilla",
      "Alcance y costos transparentes",
      "Acompañamiento después de publicar",
    ],
  },
  demo: {
    eyebrow: "Demostraciones",
    title: "No solo te contamos lo que hacemos. Te dejamos experimentarlo.",
    description:
      "Explora dispositivos, industrias y estilos para imaginar una dirección antes de comenzar.",
    bullets: [
      "Demostrador por industria",
      "Vista responsive",
      "Paletas y estilos",
      "Construcción modular",
      "Fallback sin WebGL",
    ],
  },
  contacto: {
    eyebrow: "Contacto",
    title: "Cuéntanos dónde quieres llegar.",
    description:
      "No necesitas tener todo resuelto. Comparte el contexto y te ayudaremos a encontrar un punto de partida.",
    contact: true,
  },
  "aviso-de-privacidad": {
    eyebrow: "Marco Normativo",
    title: "Aviso de Privacidad Integral",
    description:
      "Conoce cómo salvaguardamos, tratamos y protegemos tus datos personales conforme a la legislación aplicable.",
    legal: true,
  },
  terminos: {
    eyebrow: "Condiciones de Servicio",
    title: "Términos y Condiciones Generales",
    description:
      "Lineamientos contractuales, alcance técnico y bases operativas para el uso del sitio y la contratación de servicios.",
    legal: true,
  },
  "politica-de-cancelacion": {
    eyebrow: "Condiciones Contractuales",
    title: "Política de Cancelación y Rescisión",
    description:
      "Criterios de terminación anticipada, asignación de recursos y efectos vinculantes según la etapa de desarrollo.",
    legal: true,
  },
  "politica-de-reembolsos": {
    eyebrow: "Condiciones Contractuales",
    title: "Política de Reembolsos y Devoluciones",
    description:
      "Mecanismos financieros aplicables a anticipos, horas de ingeniería ejecutadas y entregables validados.",
    legal: true,
  },
  cookies: {
    eyebrow: "Políticas Técnicas",
    title: "Política de Cookies y Métricas",
    description:
      "Información sobre el almacenamiento local, rastreo esencial y analítica operativa del sitio web.",
    legal: true,
  },
};

const legalContentBySlug: Record<string, ReactNode> = {
  "aviso-de-privacidad": (
    <>
      <h2>1. Identidad y Domicilio del Responsable</h2>
      <p>
        Punto Digital, en estricto cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y su Reglamento, manifiesta ser el responsable del tratamiento, uso y resguardo de la información y datos personales recabados a través de este sitio web.
      </p>
      <h2>2. Finalidades del Tratamiento de Datos</h2>
      <p>
        Los datos personales que recabamos son utilizados de manera lícita y proporcional para las siguientes finalidades primarias indispensables:
      </p>
      <ul>
        <li>Atención y canalización de consultas técnicas o comerciales formuladas vía formularios o canales directos.</li>
        <li>Elaboración, presentación y formalización de propuestas técnico-económicas de desarrollo web y software.</li>
        <li>Cumplimiento y ejecución de los contratos de servicios, facturación y seguimiento operativo.</li>
      </ul>
      <p>
        De forma complementaria, aquellos datos proporcionados con consentimiento expreso podrán emplearse para finalidades secundarias consistentes en el envío de actualizaciones operativas o información comercial sobre nuevos módulos o servicios. En ningún momento el consentimiento para fines secundarios condicionará la prestación de los servicios contratados.
      </p>
      <h2>3. Ejercicio de Derechos ARCO y Revocación del Consentimiento</h2>
      <p>
        Usted tiene derecho al Acceso, Rectificación, Cancelación u Oposición (Derechos ARCO) respecto al tratamiento de sus datos personales, así como a revocar el consentimiento previamente otorgado. Para ejercer estos derechos, podrá formular solicitud expresa a través del formulario de contacto oficial o mediante comunicación escrita dirigida al área de privacidad de Punto Digital, acompañando acreditación fehaciente de su identidad y descripción de la petición conducente.
      </p>
      <h2>4. Transferencia y Resguardo de la Información</h2>
      <p>
        Punto Digital no comercializa, transfiere ni cede sus datos personales a terceras entidades ajenas a la relación contractual sin su autorización expresa, salvo en las hipótesis exceptuadas por el artículo 37 de la LFPDPPP o cuando medie mandamiento legal dictado por autoridad competente. Implementamos medidas de seguridad técnicas, físicas y administrativas suficientes para evitar la vulneración, pérdida o alteración indebida de su información.
      </p>
      <small>Última actualización: Septiembre de 2026.</small>
    </>
  ),
  terminos: (
    <>
      <h2>1. Objeto y Alcance Contractual</h2>
      <p>
        Los presentes Términos y Condiciones regulan el acceso, navegación y uso del portal de Punto Digital, así como las bases precontractuales aplicables a los servicios de diseño web, desarrollo de software a la medida, mantenimiento e infraestructura digital. Toda relación de prestación de servicios definitiva se formaliza y rige puntualmente por su respectiva propuesta técnica, presupuesto aprobado y contrato bilateral correspondiente.
      </p>
      <h2>2. Perfeccionamiento del Consentimiento y Cotizaciones</h2>
      <p>
        Los simuladores, configuradores de paquetes y estimaciones de precios contenidos en el sitio constituyen herramientas informativas referenciales. La cotización definitiva, plazos de desarrollo, hitos de entrega y obligaciones mutuas quedarán formalmente perfeccionados una vez que el cliente apruebe la propuesta económica integral y se dé cumplimiento a las condiciones comerciales estipuladas.
      </p>
      <h2>3. Propiedad Intelectual y Derechos de Autor</h2>
      <p>
        Todos los diseños, logotipos, textos, código fuente, componentes interactivos y marcas mostrados en este portal son propiedad exclusiva de Punto Digital o se cuenta con la correspondiente licencia para su explotación. Queda estrictamente prohibida la reproducción, distribución o ingeniería inversa total o parcial sin autorización expresa y por escrito. Salvo estipulación en contrario en el contrato individual, la titularidad patrimonial sobre los entregables definitivos se transfiere al cliente una vez liquidada la totalidad de la contraprestación pactada.
      </p>
      <h2>4. Límites de Responsabilidad Técnica</h2>
      <p>
        Punto Digital aplica estándares de la industria en la ejecución técnica y configuración de servicios. No obstante, no asume responsabilidad por interrupciones, suspensiones o demoras derivadas de causas de fuerza mayor, fallas imputables a proveedores externos de infraestructura (servidores de hosting ajenos, registradores de dominio, pasarelas de pago externas como Stripe o PayPal), o derivados de modificaciones operativas no autorizadas efectuadas por el cliente sobre el código o servidor.
      </p>
      <h2>5. Jurisdicción y Legislación Aplicable</h2>
      <p>
        Para la interpretación y resolución de cualquier controversia emanada de la relación comercial o del uso del sitio web, las partes se someten a la legislación aplicable en materia mercantil y a la jurisdicción de los tribunales competentes en Guadalajara, Jalisco, renunciando a cualquier otro fuero que pudiera corresponderles por razón de sus domicilios presentes o futuros.
      </p>
      <small>Última actualización: Septiembre de 2026.</small>
    </>
  ),
  "politica-de-cancelacion": (
    <>
      <h2>1. Naturaleza del Servicio y Asignación de Recursos</h2>
      <p>
        La contratación de servicios de diseño, arquitectura web y programación personalizada implica la reserva prioritaria de infraestructura técnica y la asignación efectiva de horas hombre especializadas a partir de la firma de la propuesta o del pago del anticipo correspondiente.
      </p>
      <h2>2. Procedimiento de Rescisión y Terminación Anticipada</h2>
      <p>
        Cualquier solicitud de cancelación unilateral deberá ser comunicada de manera formal por escrito mediante los canales autorizados. Los efectos de la cancelación se sujetarán invariablemente a la etapa de ejecución en que se encuentre el proyecto:
      </p>
      <ul>
        <li><strong>Fase Preliminar (Previo a arranque de diseño o ingeniería):</strong> En caso de notificarse antes del inicio de cualquier trabajo técnico o conceptual, se dará por rescindido el compromiso, descontando exclusivamente los cargos operativos, administrativos o de comisiones bancarias no recuperables.</li>
        <li><strong>Fase Activa (Durante diseño, prototipado o programación):</strong> Al haberse consumido recursos técnicos y horas de desarrollo, la rescisión facultará a Punto Digital a liquidar proporcionalmente el valor de las horas ejecutadas y los costos incurridos hasta la fecha de notificación fehaciente.</li>
        <li><strong>Fase de Validación o Despliegue:</strong> No procederá la cancelación en proyectos cuyos entregables hayan sido presentados para visto bueno final o se encuentren desplegados en servidores de prueba o producción.</li>
      </ul>
      <h2>3. Suspensión por Falta de Entrega de Información</h2>
      <p>
        La falta de suministro de insumos esenciales (contenidos, accesos, requerimientos) por parte del cliente por un período superior al establecido en la propuesta facultará a Punto Digital a suspender el desarrollo del proyecto y reasignar las fechas de entrega con base en la disponibilidad técnica subsecuente.
      </p>
      <small>Última actualización: Septiembre de 2026.</small>
    </>
  ),
  "politica-de-reembolsos": (
    <>
      <h2>1. Régimen de Anticipos y Contraprestación Devengada</h2>
      <p>
        Los pagos y anticipos cubiertos por el cliente garantizan la disponibilidad del equipo de desarrollo, la adquisición de licencias o recursos de terceros requeridos y la ejecución progresiva de las etapas pactadas. En consecuencia, toda devolución se encuentra sujeta a la comprobación de saldos no devengados.
      </p>
      <h2>2. Supuestos de Devolución</h2>
      <p>
        Procederá la restitución económica únicamente en los supuestos expresamente convenidos:
      </p>
      <ul>
        <li>Incumplimiento total y justificado imputable de manera directa y exclusiva a Punto Digital en la entrega de los hitos técnicos comprometidos en la propuesta definitiva.</li>
        <li>Errores de cobro o pagos duplicados procesados por la pasarela de pagos correspondiente, los cuales se reintegrarán en el mismo medio de pago utilizado tras la verificación contable.</li>
      </ul>
      <h2>3. Supuestos de Improcedencia</h2>
      <p>
        No procederá reembolso alguno en los siguientes casos:
      </p>
      <ul>
        <li>Sobre entregables, fases o hitos de diseño y desarrollo que ya hubiesen sido formalmente validados o entregados.</li>
        <li>Por desistimiento unilateral sobre fases técnicas cuyos tiempos de desarrollo ya fueron devengados y justificados técnicamente.</li>
        <li>Sobre pagos correspondientes a servicios recurrentes de mantenimiento, licencias de terceros, dominios o servidores ya emitidos o activados.</li>
      </ul>
      <small>Última actualización: Septiembre de 2026.</small>
    </>
  ),
  cookies: (
    <>
      <h2>1. Concepto y Funcionamiento</h2>
      <p>
        Este sitio web utiliza cookies y tecnologías de almacenamiento local consistentes en pequeños fragmentos de información enviados a su navegador para permitir la correcta funcionalidad técnica de la plataforma, autenticar solicitudes y recordar parámetros de navegación.
      </p>
      <h2>2. Clasificación de Cookies Empleadas</h2>
      <ul>
        <li><strong>Cookies Esenciales o Técnicas:</strong> Indispensables para la navegación, seguridad estructural, prevención de ataques informáticos y gestión de sesiones interactivas. No requieren consentimiento previo al ser técnicamente necesarias para la operatividad del sitio.</li>
        <li><strong>Cookies de Análisis y Rendimiento:</strong> Destinadas a medir patrones de tráfico y uso agregado del portal a fin de optimizar la interfaz y velocidad de carga, sin asociar la navegación a perfiles que permitan la identificación directa del usuario.</li>
      </ul>
      <h2>3. Control y Desactivación</h2>
      <p>
        El usuario puede en cualquier momento restringir, bloquear o borrar las cookies configurando las opciones de privacidad de su navegador. Se hace constar que la deshabilitación total de cookies técnicas esenciales puede limitar el funcionamiento de ciertas herramientas o formularios interactivos dentro de este sitio.
      </p>
      <small>Última actualización: Septiembre de 2026.</small>
    </>
  ),
};

export function getMarketingData(slug: string[]): PageData | null {
  if (slug[0] === "servicios" && slug[1]) return serviceData[slug[1]] ?? null;
  if (slug[0] === "soluciones" && slug[1]) {
    const industry = slug[1].replaceAll("-", " ");
    return {
      eyebrow: `Soluciones para ${industry}`,
      title: `Una página profesional pensada para ${industry}.`,
      description:
        "Organizamos la información que tus clientes necesitan para entender tu valor, confiar y dar el siguiente paso.",
      bullets: [
        "Mensaje adaptado al sector",
        "Servicios fáciles de explorar",
        "Contacto directo",
        "Diseño responsive",
        "Base lista para Google",
      ],
    };
  }
  return pageData[slug.join("/")] ?? null;
}

export function MarketingPage({
  data,
  slug,
}: {
  data: PageData;
  slug: string;
}) {
  return (
    <main id="contenido" className="inner-page">
      <section className="inner-hero">
        <div className="inner-hero-grid" />
        <div className="eyebrow eyebrow--light">
          <span /> {data.eyebrow}
        </div>
        <h1>{data.title}</h1>
        <p>{data.description}</p>
        {!data.legal && (
          <div>
            <Link className="button button--light" href="/cotizador">
              Configurar mi página <ArrowRight size={17} />
            </Link>
            <Link className="text-link text-link--light" href="/contacto">
              <MessageCircle size={17} /> Hablemos
            </Link>
          </div>
        )}
      </section>

      <section className="inner-content">
        {data.contact ? (
          <div className="contact-layout">
            <div>
              <span>Hagámoslo simple</span>
              <h2>Un mensaje es suficiente para comenzar.</h2>
              <p>
                Atendemos proyectos en todo México. El tiempo de respuesta habitual es de un día hábil.
              </p>
              <p>
                Utiliza el formulario para que la solicitud quede vinculada a esta conversación.
              </p>
            </div>
            <ContactForm />
          </div>
        ) : data.legal ? (
          <div className="legal-copy">
            {legalContentBySlug[slug] ?? (
              <>
                <h2>Principios Generales</h2>
                <p>
                  Punto Digital trata únicamente la información necesaria para responder solicitudes, preparar propuestas, procesar contrataciones y prestar los servicios acordados.
                </p>
                <h2>Responsabilidad y Consentimiento</h2>
                <p>
                  Las condiciones definitivas aplicables a cada proyecto se detallarán puntualmente en su propuesta técnica y contrato bilateral correspondiente. Las comunicaciones comerciales opcionales requerirán consentimiento separado y expreso.
                </p>
                <h2>Contacto</h2>
                <p>
                  Para ejercer derechos o solicitar aclaraciones formales, utilice los canales de contacto de este sitio.
                </p>
                <small>Última actualización: Septiembre de 2026.</small>
              </>
            )}
          </div>
        ) : slug === "paquetes" ? (
          <div className="simple-pricing">
            {PRODUCTS.map((product) => (
              <article key={product.slug}>
                <span>{product.eyebrow}</span>
                <h2>{product.name}</h2>
                <strong>
                  {product.price
                    ? formatMoney(product.price)
                    : "Cotización personalizada"}
                </strong>
                <p>{product.description}</p>
                <ul>
                  {product.features.map((item) => (
                    <li key={item}>
                      <Check size={15} />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href={`/cotizador?paquete=${product.slug}`}>
                  Elegir paquete <ArrowRight size={15} />
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="content-feature">
            <div>
              <span>Lo esencial</span>
              <h2>Construido para ayudar a que tu negocio se vea, se entienda y se elija.</h2>
              <p>Definimos el alcance contigo y documentamos cada condición antes de comenzar.</p>
            </div>
            <ul>
              {data.bullets?.map((bullet) => (
                <li key={bullet}>
                  <Check size={18} />
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="inner-cta">
        <h2>El siguiente punto de tu negocio puede empezar hoy.</h2>
        <Link className="button" href="/cotizador">
          Crear mi propuesta <ArrowRight size={17} />
        </Link>
      </section>
    </main>
  );
}