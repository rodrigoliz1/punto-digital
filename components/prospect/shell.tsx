"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarClock, ClipboardCheck, Coins, LayoutDashboard, Megaphone, MonitorSmartphone, Palette, Radar, ScrollText, Settings, ShieldOff, Trophy } from "lucide-react";

const BASE = "/admin/prospectos";
const NAV = [
  { href: BASE, label: "Resumen", icon: LayoutDashboard, exact: true },
  { href: `${BASE}/descubrir`, label: "Prospección", icon: Radar },
  { href: `${BASE}/lista`, label: "Prospectos", icon: Building2 },
  { href: `${BASE}/marca`, label: "Análisis de marca", icon: Palette },
  { href: `${BASE}/demos`, label: "Demos", icon: MonitorSmartphone },
  { href: `${BASE}/campanas`, label: "Campañas y aprobación", icon: Megaphone },
  { href: `${BASE}/seguimiento`, label: "Seguimiento y reuniones", icon: CalendarClock },
  { href: `${BASE}/clientes`, label: "Clientes y finanzas", icon: Trophy },
  { href: `${BASE}/exclusiones`, label: "Exclusiones", icon: ShieldOff },
  { href: `${BASE}/costos`, label: "Costos de APIs", icon: Coins },
  { href: `${BASE}/auditoria`, label: "Auditoría", icon: ScrollText },
  { href: `${BASE}/configuracion`, label: "Configuración", icon: Settings },
];

export function ProspectShell({ children, email, roleLabel }: { children: React.ReactNode; email: string; roleLabel: string }) {
  const pathname = usePathname() ?? BASE;
  const initials = email.slice(0, 2).toUpperCase();
  return (
    <main className="dashboard-page po">
      <aside className="dashboard-sidebar po-sidebar">
        <Link href="/" className="wordmark wordmark--light"><span className="brand-mark"><i /><i /><i /></span><span><strong>Punto<span>.</span></strong> Digital</span></Link>
        <small>Prospect OS</small>
        <nav aria-label="Prospect OS">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return <Link key={href} href={href} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined}><Icon size={17} />{label}</Link>;
          })}
        </nav>
        <div className="sidebar-help"><ClipboardCheck size={20} /><strong>Contacto solo manual</strong><p>Ningún agente envía mensajes. Toda aprobación queda registrada con tu nombre.</p></div>
      </aside>
      <section className="dashboard-main po-main">
        <header>
          <div><span className="status-dot" /> Prospección asistida · Guadalajara y Zapopan</div>
          <div><span className="po-role">{roleLabel}</span><div className="user-avatar" title={email}>{initials}</div></div>
        </header>
        <div className="po-content">{children}</div>
      </section>
    </main>
  );
}
