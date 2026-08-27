export const SITE = {
  name: "Punto Digital",
  domain: "www.ipunto.digital",
  url: "https://www.ipunto.digital",
  description: "Páginas web profesionales, rápidas y diseñadas para convertir visitas en oportunidades reales.",
  slogan: "Tu punto de partida digital.",
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
} as const;

export const NAVIGATION = [
  { label: "Servicios", href: "/servicios" },
  { label: "Paquetes", href: "/paquetes" },
  { label: "Proyectos", href: "/proyectos" },
  { label: "Cómo funciona", href: "/proceso" },
  { label: "Nosotros", href: "/nosotros" },
] as const;

export const INDUSTRIES = [
  { slug: "juridico", name: "Despacho jurídico", headline: "Defendemos lo que más importa.", service: "Asesoría legal con claridad", color: "#1d4ed8", accent: "#bfdbfe" },
  { slug: "clinica", name: "Clínica", headline: "Cuidarte empieza por escucharte.", service: "Atención médica cercana", color: "#0f766e", accent: "#ccfbf1" },
  { slug: "restaurante", name: "Restaurante", headline: "Una mesa que siempre querrás repetir.", service: "Cocina honesta, momentos memorables", color: "#9a3412", accent: "#ffedd5" },
  { slug: "constructora", name: "Constructora", headline: "Construimos con visión de futuro.", service: "Obra que trasciende", color: "#334155", accent: "#e2e8f0" },
  { slug: "inmobiliaria", name: "Inmobiliaria", headline: "Encuentra el lugar para tu siguiente historia.", service: "Propiedades seleccionadas", color: "#6d28d9", accent: "#ede9fe" },
  { slug: "creativo", name: "Estudio creativo", headline: "Ideas que se sienten y funcionan.", service: "Dirección creativa y diseño", color: "#be123c", accent: "#ffe4e6" },
  { slug: "comercio", name: "Comercio", headline: "Lo que buscas, más cerca de ti.", service: "Productos elegidos para tu día", color: "#0369a1", accent: "#e0f2fe" },
] as const;
