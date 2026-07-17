import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const columns = [
  { title: "Explora", links: [["Servicios", "/servicios"], ["Paquetes", "/paquetes"], ["Proyectos", "/proyectos"], ["Proceso", "/proceso"]] },
  { title: "Empieza", links: [["Cotizador", "/cotizador"], ["Demostraciones", "/demo"], ["Contacto", "/contacto"], ["Portal del cliente", "/cliente"]] },
  { title: "Legal", links: [["Aviso de privacidad", "/aviso-de-privacidad"], ["Términos", "/terminos"], ["Cancelación", "/politica-de-cancelacion"], ["Reembolsos", "/politica-de-reembolsos"]] },
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <Link href="/" className="wordmark wordmark--light"><span className="brand-mark"><i /><i /><i /></span><span><strong>Punto<span>.</span></strong> Digital</span></Link>
          <p>Diseñamos el lugar donde tu negocio se ve, se entiende y se elige.</p>
          <a className="footer-email" href="mailto:hola@punto-digital.mx">hola@punto-digital.mx <ArrowUpRight size={18} /></a>
        </div>
        {columns.map((column) => (
          <div className="footer-column" key={column.title}>
            <h3>{column.title}</h3>
            {column.links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
          </div>
        ))}
      </div>
      <div className="footer-bottom"><p>© {new Date().getFullYear()} Punto Digital. México.</p><p>Hecho para que los buenos negocios dejen de pasar desapercibidos.</p></div>
    </footer>
  );
}
