import type { Industry, PreviewSection, ProjectType } from "@/types";

export type IndustryModule =
  | "authority"
  | "appointment"
  | "smile-gallery"
  | "menu"
  | "project-portfolio"
  | "property-search"
  | "editorial-portfolio"
  | "booking-gallery"
  | "membership"
  | "programs"
  | "catalog"
  | "integrations"
  | "adaptive";

export type IndustryDefinition = {
  slug: Industry;
  label: string;
  eyebrow: string;
  headline: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  services: readonly [string, string, string];
  trustItems: readonly [string, string, string];
  module: IndustryModule;
  visualTheme: string;
  imageStyle: string;
  palette: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
    soft: string;
    text: string;
    muted: string;
    border: string;
  };
};

export const PROJECT_TYPES: ReadonlyArray<{ slug: ProjectType; label: string; description: string; sections: readonly PreviewSection[] }> = [
  { slug: "landing", label: "Landing page", description: "Una oferta enfocada en generar contactos", sections: ["hero", "benefits", "trust", "form", "testimonials", "cta", "footer"] },
  { slug: "corporate", label: "Sitio corporativo", description: "Una presencia completa para tu empresa", sections: ["hero", "trust", "services", "authority", "testimonials", "cta", "footer"] },
  { slug: "ecommerce", label: "Tienda en línea", description: "Catálogo, pagos y operación inicial", sections: ["hero", "products", "benefits", "testimonials", "cta", "footer"] },
  { slug: "redesign", label: "Rediseño", description: "Mejorar una página que ya existe", sections: ["hero", "benefits", "services", "authority", "cta", "footer"] },
  { slug: "campaign", label: "Página para campaña", description: "Una experiencia temporal y medible", sections: ["hero", "benefits", "form", "trust", "cta", "footer"] },
  { slug: "portal", label: "Portal o sistema", description: "Usuarios, flujos e integraciones", sections: ["dashboard", "services", "integrations", "cta"] },
];

export const INDUSTRIES: readonly IndustryDefinition[] = [
  {
    slug: "professional-services", label: "Servicios profesionales", eyebrow: "Estrategia y experiencia",
    headline: "Claridad para tomar decisiones que hacen avanzar tu empresa.",
    description: "Acompañamiento especializado, comunicación directa y una ruta clara para cada decisión importante.",
    primaryCta: "Solicitar asesoría", secondaryCta: "Conocer servicios",
    services: ["Estrategia empresarial", "Consultoría especializada", "Acompañamiento ejecutivo"],
    trustItems: ["Atención personalizada", "Respuesta ágil", "Proceso transparente"], module: "authority",
    visualTheme: "corporate-authority", imageStyle: "office-editorial",
    palette: { primary: "#175CD3", accent: "#C7A96B", background: "#F5F8FC", surface: "#FFFFFF", soft: "#E9F1FD", text: "#0B1F3A", muted: "#617089", border: "#DCE5F0" },
  },
  {
    slug: "medical", label: "Clínica médica", eyebrow: "Salud con atención humana",
    headline: "Atención profesional para cuidar de ti y tu familia.",
    description: "Especialistas, horarios y orientación clara para que agendar tu consulta sea sencillo.",
    primaryCta: "Agendar consulta", secondaryCta: "Conocer especialistas",
    services: ["Consulta especializada", "Prevención y seguimiento", "Atención integral"],
    trustItems: ["Especialistas certificados", "Agenda flexible", "Atención cercana"], module: "appointment",
    visualTheme: "clinical-human", imageStyle: "bright-human",
    palette: { primary: "#087EA4", accent: "#35B78E", background: "#F4FAFC", surface: "#FFFFFF", soft: "#E3F5F8", text: "#123047", muted: "#668094", border: "#D8E9EE" },
  },
  {
    slug: "dental", label: "Clínica dental", eyebrow: "Sonrisas con confianza",
    headline: "Una sonrisa sana cambia la forma de sentirte cada día.",
    description: "Tratamientos explicados con claridad, tecnología moderna y una experiencia cómoda desde la primera visita.",
    primaryCta: "Agendar valoración", secondaryCta: "Ver tratamientos",
    services: ["Diseño de sonrisa", "Ortodoncia", "Odontología preventiva"],
    trustItems: ["Valoración personalizada", "Opciones de pago", "Tecnología digital"], module: "smile-gallery",
    visualTheme: "dental-bright", imageStyle: "smile-closeup",
    palette: { primary: "#00A8B5", accent: "#36C2E1", background: "#F3FCFD", surface: "#FFFFFF", soft: "#DFF8FA", text: "#102F3A", muted: "#66818A", border: "#D5ECEF" },
  },
  {
    slug: "restaurant", label: "Restaurante", eyebrow: "Cocina que se recuerda",
    headline: "Una experiencia que comienza antes del primer bocado.",
    description: "Sabores honestos, ingredientes de temporada y una mesa lista para convertir cualquier momento en ocasión.",
    primaryCta: "Reservar mesa", secondaryCta: "Explorar menú",
    services: ["Menú de temporada", "Experiencias privadas", "Pedidos para llevar"],
    trustItems: ["Ingredientes locales", "Reservación inmediata", "Ambiente excepcional"], module: "menu",
    visualTheme: "culinary-warm", imageStyle: "food-cinematic",
    palette: { primary: "#B14727", accent: "#E7B35E", background: "#FBF7F0", surface: "#FFFDF9", soft: "#F5E7D6", text: "#2C1D18", muted: "#7D675D", border: "#EADFD2" },
  },
  {
    slug: "construction", label: "Constructora", eyebrow: "Obra con visión",
    headline: "Construimos espacios que convierten proyectos en realidad.",
    description: "Planeación, ejecución y control para avanzar con certeza desde el primer plano hasta la entrega.",
    primaryCta: "Solicitar cotización", secondaryCta: "Ver proyectos",
    services: ["Construcción integral", "Supervisión de obra", "Remodelación especializada"],
    trustItems: ["Control de proyecto", "Calidad verificable", "Avances transparentes"], module: "project-portfolio",
    visualTheme: "architectural-industrial", imageStyle: "wide-structures",
    palette: { primary: "#D18424", accent: "#283849", background: "#F3F2EF", surface: "#FFFFFF", soft: "#E8E4DC", text: "#17212B", muted: "#69727A", border: "#DDDAD3" },
  },
  {
    slug: "real-estate", label: "Inmobiliaria", eyebrow: "Propiedades seleccionadas",
    headline: "Encuentra el espacio donde comienza tu siguiente etapa.",
    description: "Explora propiedades, compara ubicaciones y agenda una visita con acompañamiento experto.",
    primaryCta: "Explorar propiedades", secondaryCta: "Agendar visita",
    services: ["Compra y venta", "Renta residencial", "Asesoría patrimonial"],
    trustItems: ["Propiedades verificadas", "Asesoría local", "Visitas flexibles"], module: "property-search",
    visualTheme: "property-premium", imageStyle: "architectural-lifestyle",
    palette: { primary: "#126B61", accent: "#C3A46B", background: "#F5F8F6", surface: "#FFFFFF", soft: "#E3EFEB", text: "#14322E", muted: "#6B7D79", border: "#D7E3DF" },
  },
  {
    slug: "architecture", label: "Arquitectura", eyebrow: "Espacio, materia, intención",
    headline: "Diseñamos espacios que permanecen más allá de la tendencia.",
    description: "Arquitectura sensible al contexto, rigurosa en el detalle y clara en cada decisión.",
    primaryCta: "Explorar proyectos", secondaryCta: "Conocer el estudio",
    services: ["Arquitectura", "Interiorismo", "Dirección creativa"],
    trustItems: ["Diseño contextual", "Detalle material", "Proceso colaborativo"], module: "editorial-portfolio",
    visualTheme: "editorial-minimal", imageStyle: "monochrome-architecture",
    palette: { primary: "#262626", accent: "#9C8260", background: "#F4F3F0", surface: "#FEFEFD", soft: "#E8E6E1", text: "#181818", muted: "#73716D", border: "#DEDDD9" },
  },
  {
    slug: "beauty", label: "Belleza o estética", eyebrow: "Cuidado que se siente",
    headline: "Tu momento para verte bien, sentirte bien y volver a ti.",
    description: "Tratamientos personalizados, espacios serenos y resultados que resaltan tu belleza natural.",
    primaryCta: "Reservar cita", secondaryCta: "Ver servicios",
    services: ["Cuidado facial", "Rituales corporales", "Paquetes de bienestar"],
    trustItems: ["Atención personalizada", "Productos premium", "Reserva sencilla"], module: "booking-gallery",
    visualTheme: "beauty-soft", imageStyle: "soft-lifestyle",
    palette: { primary: "#A65D78", accent: "#D9B8A5", background: "#FCF7F8", surface: "#FFFFFF", soft: "#F4E7EB", text: "#3B2930", muted: "#806B74", border: "#EBDCE1" },
  },
  {
    slug: "fitness", label: "Gimnasio o bienestar", eyebrow: "Entrena con propósito",
    headline: "Más energía, más fuerza, una versión de ti que avanza.",
    description: "Clases, entrenadores y planes creados para convertir la constancia en resultados reales.",
    primaryCta: "Probar una clase", secondaryCta: "Ver membresías",
    services: ["Entrenamiento funcional", "Clases en grupo", "Coaching personal"],
    trustItems: ["Entrenadores expertos", "Horarios amplios", "Comunidad activa"], module: "membership",
    visualTheme: "fitness-energy", imageStyle: "high-contrast-action",
    palette: { primary: "#F05A28", accent: "#B8F23D", background: "#111315", surface: "#1A1D20", soft: "#252A2D", text: "#F7F8F5", muted: "#9FA7A3", border: "#34393D" },
  },
  {
    slug: "education", label: "Educación", eyebrow: "Aprender para transformar",
    headline: "Programas que convierten curiosidad en nuevas posibilidades.",
    description: "Aprendizaje práctico, docentes cercanos y rutas claras para avanzar a tu propio ritmo.",
    primaryCta: "Ver programas", secondaryCta: "Iniciar inscripción",
    services: ["Programas formativos", "Cursos en línea", "Recursos para alumnos"],
    trustItems: ["Docentes con experiencia", "Aprendizaje práctico", "Comunidad de apoyo"], module: "programs",
    visualTheme: "education-dynamic", imageStyle: "bright-learning",
    palette: { primary: "#4F46C7", accent: "#F3B83E", background: "#F7F7FD", surface: "#FFFFFF", soft: "#EAE9FA", text: "#25234B", muted: "#73718D", border: "#DFDEF0" },
  },
  {
    slug: "retail", label: "Comercio", eyebrow: "Selección para cada día",
    headline: "Descubre productos pensados para hacer tu día más fácil.",
    description: "Compra con confianza, encuentra novedades y recibe atención directa cuando la necesites.",
    primaryCta: "Comprar ahora", secondaryCta: "Ver catálogo",
    services: ["Nuevos productos", "Promociones", "Atención por WhatsApp"],
    trustItems: ["Compra segura", "Entrega confiable", "Atención directa"], module: "catalog",
    visualTheme: "retail-colorful", imageStyle: "product-studio",
    palette: { primary: "#7A3FE0", accent: "#FF6B5D", background: "#FAF8FE", surface: "#FFFFFF", soft: "#EEE7FB", text: "#2B1F3D", muted: "#756A82", border: "#E4DDF0" },
  },
  {
    slug: "technology", label: "Tecnología", eyebrow: "Producto digital conectado",
    headline: "Tecnología que simplifica lo complejo y acelera decisiones.",
    description: "Automatiza operaciones, conecta tus herramientas y convierte datos en una ventaja diaria.",
    primaryCta: "Solicitar demo", secondaryCta: "Ver integraciones",
    services: ["Automatización", "Analítica en tiempo real", "Integraciones"],
    trustItems: ["Implementación ágil", "Datos protegidos", "Escala contigo"], module: "integrations",
    visualTheme: "technology-electric", imageStyle: "data-gradient",
    palette: { primary: "#387BFF", accent: "#35D7FF", background: "#07111F", surface: "#0D1A2C", soft: "#122641", text: "#F3F7FF", muted: "#8FA5C3", border: "#203653" },
  },
  {
    slug: "other", label: "Otra industria", eyebrow: "Una dirección hecha para ti",
    headline: "Una presencia clara, memorable y preparada para crecer.",
    description: "Una experiencia adaptable que organiza tu propuesta y facilita el siguiente paso de tus clientes.",
    primaryCta: "Empezar conversación", secondaryCta: "Conocer la propuesta",
    services: ["Servicio principal", "Solución especializada", "Atención personalizada"],
    trustItems: ["Diseño personalizado", "Experiencia clara", "Soporte cercano"], module: "adaptive",
    visualTheme: "adaptive-premium", imageStyle: "brand-abstract",
    palette: { primary: "#1769FF", accent: "#00B8D9", background: "#F5F8FD", surface: "#FFFFFF", soft: "#E7F0FF", text: "#0B1F3A", muted: "#66758A", border: "#DCE5F1" },
  },
] as const;

export const INDUSTRY_MAP = Object.fromEntries(INDUSTRIES.map((industry) => [industry.slug, industry])) as Record<Industry, IndustryDefinition>;

export const NAVIGATION_VARIANTS = ["minimal", "corporate", "commerce", "editorial", "app"] as const;
export const HERO_VARIANTS = ["split", "centered", "editorial", "layered", "minimal", "immersive"] as const;
export const CARD_VARIANTS = ["solid", "outline", "lifted", "soft", "glass", "media"] as const;
export const FORM_VARIANTS = ["inline", "card", "split", "floating"] as const;
export const TESTIMONIAL_VARIANTS = ["quote-grid", "spotlight", "carousel", "avatars", "case-study"] as const;
export const PRODUCT_VARIANTS = ["catalog-grid", "editorial-list", "featured-split", "compact-rail"] as const;
export const DASHBOARD_VARIANTS = ["executive", "operations", "crm", "analytics"] as const;
export const FOOTER_VARIANTS = ["compact", "columns", "cta", "dark", "editorial"] as const;
export const TYPOGRAPHY_PAIRS = ["modern", "corporate", "editorial", "humanist", "geometric", "luxury", "technical", "friendly"] as const;

export const TYPOGRAPHY_MAP: Record<(typeof TYPOGRAPHY_PAIRS)[number], { heading: string; body: string }> = {
  modern: { heading: "var(--font-manrope)", body: "var(--font-inter)" },
  corporate: { heading: "var(--font-inter)", body: "var(--font-inter)" },
  editorial: { heading: "Georgia, 'Times New Roman', serif", body: "var(--font-inter)" },
  humanist: { heading: "Trebuchet MS, var(--font-manrope)", body: "var(--font-inter)" },
  geometric: { heading: "Avenir Next, var(--font-manrope)", body: "var(--font-inter)" },
  luxury: { heading: "Didot, Georgia, serif", body: "var(--font-inter)" },
  technical: { heading: "ui-monospace, SFMono-Regular, monospace", body: "var(--font-inter)" },
  friendly: { heading: "Arial Rounded MT Bold, var(--font-manrope)", body: "var(--font-inter)" },
};

export const LEGACY_PROJECT_TYPE_MAP: Record<string, ProjectType> = {
  landing: "landing", corporativo: "corporate", corporate: "corporate", tienda: "ecommerce", ecommerce: "ecommerce",
  redesign: "redesign", campaign: "campaign", system: "portal", portal: "portal",
};

export const LEGACY_INDUSTRY_MAP: Record<string, Industry> = {
  "Servicios profesionales": "professional-services", "Despacho jurídico": "professional-services",
  "Salud y bienestar": "medical", "Clínica médica": "medical", "Clínica dental": "dental",
  Restaurante: "restaurant", Construcción: "construction", Inmobiliaria: "real-estate",
  Arquitectura: "architecture", Creativo: "architecture", "Belleza o estética": "beauty",
  "Gimnasio o bienestar": "fitness", Educación: "education", Comercio: "retail",
  Tecnología: "technology", Otro: "other", "Otra industria": "other",
};
