import type { Addon, Product } from "@/types";

export const PRODUCTS: Product[] = [
  {
    slug: "esencial",
    name: "Punto Esencial",
    eyebrow: "Para empezar bien",
    description: "Una presencia clara y profesional para convertir interés en conversaciones.",
    price: 9900,
    depositPercentage: 50,
    timeline: "3 a 5 semanas",
    features: ["Landing page", "Hasta 6 secciones", "WhatsApp y formulario", "Dominio y hosting por 1 año", "SEO inicial", "1 ronda de ajustes"],
  },
  {
    slug: "profesional",
    name: "Punto Profesional",
    eyebrow: "La opción recomendada",
    description: "Un sitio completo para explicar, demostrar y posicionar mejor tu negocio.",
    price: 18900,
    depositPercentage: 50,
    timeline: "5 a 8 semanas",
    featured: true,
    features: ["Hasta 7 páginas", "Diseño personalizado", "SEO técnico", "Analytics y Search Console", "Galería o portafolio", "2 rondas de ajustes"],
  },
  {
    slug: "tienda",
    name: "Punto Tienda",
    eyebrow: "Para vender en línea",
    description: "Catálogo, pagos y operación inicial en una experiencia de compra confiable.",
    price: 39900,
    depositPercentage: 50,
    timeline: "8 a 12 semanas",
    features: ["Catálogo y carrito", "Checkout y pagos", "Inventario inicial", "Cupones y envíos", "Correos transaccionales", "Capacitación"],
  },
  {
    slug: "medida",
    name: "Punto a Medida",
    eyebrow: "Cuando el negocio pide más",
    description: "Portales, reservaciones, usuarios, automatizaciones e integraciones propias.",
    price: null,
    depositPercentage: 50,
    timeline: "Definido después del diagnóstico",
    features: ["Alcance a la medida", "Arquitectura de producto", "Paneles y usuarios", "Integraciones", "Automatizaciones", "Acompañamiento técnico"],
  },
];

export const ADDONS: Addon[] = [
  { slug: "blog", name: "Blog administrable", description: "Publica contenido y novedades.", price: 3900 },
  { slug: "booking", name: "Agenda y citas", description: "Integra reservaciones con calendario.", price: 4900 },
  { slug: "catalog", name: "Catálogo avanzado", description: "Organiza productos sin cobro en línea.", price: 6900 },
  { slug: "multilanguage", name: "Segundo idioma", description: "Estructura y navegación bilingüe.", price: 5900 },
  { slug: "copy", name: "Redacción comercial", description: "Textos claros para las páginas principales.", price: 4900 },
  { slug: "branding", name: "Identidad esencial", description: "Logotipo, color y sistema visual inicial.", price: 7900 },
];

export const MAINTENANCE = [
  { name: "Punto Base", price: 590, detail: "Hosting, SSL, monitoreo, respaldos y soporte esencial." },
  { name: "Punto Activo", price: 1190, detail: "Una hora de ajustes, revisión de formularios y reporte básico." },
  { name: "Punto Crece", price: 2490, detail: "Cuatro horas, optimización continua, SEO básico y prioridad." },
] as const;

export function formatMoney(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function calculateQuote(productSlug: string, addonSlugs: string[]) {
  const product = PRODUCTS.find((item) => item.slug === productSlug) ?? PRODUCTS[1];
  const addons = ADDONS.filter((item) => addonSlugs.includes(item.slug));
  const base = product.price ?? 0;
  const extras = addons.reduce((sum, item) => sum + item.price, 0);
  const total = base + extras;
  return { product, addons, base, extras, total, deposit: Math.round(total * product.depositPercentage / 100) };
}
