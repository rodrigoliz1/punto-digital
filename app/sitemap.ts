import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/servicios", "/servicios/landing-pages", "/servicios/sitios-corporativos", "/servicios/tiendas-en-linea", "/servicios/sistemas-web", "/servicios/mantenimiento", "/paquetes", "/proyectos", "/proceso", "/nosotros", "/demo", "/cotizador", "/contacto", "/aviso-de-privacidad", "/terminos", "/politica-de-cancelacion", "/politica-de-reembolsos", ...["abogados", "medicos", "dentistas", "restaurantes", "constructoras", "inmobiliarias", "arquitectos", "contadores", "comercios", "profesionistas"].map((item) => `/soluciones/${item}`)];
  return routes.map((route) => ({ url: `${SITE.url}${route}`, lastModified: new Date(), changeFrequency: route === "" ? "weekly" : "monthly", priority: route === "" ? 1 : route === "/cotizador" ? 0.9 : 0.7 }));
}
