"use client";

import Link from "next/link";
import { MessageCircle, Menu, X, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NAVIGATION } from "@/config/site";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <header className={`site-header ${scrolled ? "site-header--scrolled" : ""} ${open ? "site-header--menu-open" : ""}`}>
      <div className="header-inner">
        <Link href="/" className="wordmark" aria-label="Punto Digital, inicio">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><strong>Punto<span>.</span></strong> Digital</span>
        </Link>

        <nav className="desktop-nav" aria-label="Navegación principal">
          {NAVIGATION.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        </nav>

        <div className="header-actions">
          <Link href="/contacto" className="icon-button" aria-label="Contactar a Punto Digital"><MessageCircle size={18} /></Link>
          <Link href="/cotizador" className="button button--small">Cotizar mi página <ArrowUpRight size={16} /></Link>
          <button className="menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? "Cerrar menú" : "Abrir menú"} style={open ? { color: "white", borderColor: "rgba(255,255,255,.4)", background: "rgba(255,255,255,.12)" } : undefined}>
            {open ? <X size={24} strokeWidth={2} /> : <Menu size={24} strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {mounted && createPortal(
        <div id="mobile-navigation" className={`mobile-menu ${open ? "mobile-menu--open" : ""}`} aria-hidden={!open} inert={!open ? true : undefined}>
          <nav aria-label="Navegación móvil">
            {NAVIGATION.map((item, index) => (
              <Link href={item.href} key={item.href} onClick={() => setOpen(false)}><span>0{index + 1}</span>{item.label}</Link>
            ))}
            <Link href="/cotizador" onClick={() => setOpen(false)}><span>06</span>Configurar mi página</Link>
          </nav>
          <p>Tu punto de partida digital.</p>
        </div>,
        document.body
      )}
    </header>
  );
}
