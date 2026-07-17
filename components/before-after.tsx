"use client";

import { useRef, useState, type PointerEvent } from "react";
import { ArrowRight, BriefcaseBusiness, CalendarCheck, Check, Clock3, LockKeyhole, MapPin, MessageCircle, MoveHorizontal, RotateCcw, Search, Share2, ShieldCheck, Sparkles } from "lucide-react";
import { trackPreviewEvent } from "@/lib/analytics";

const INITIAL_POSITION = 52;

function BeforeMockup() {
  return (
    <div className="ba-before-scene" aria-hidden="true">
      <div className="ba-social-window">
        <header><i /><i /><i /><span>red-social.com/mi_negocio_oficial</span></header>
        <div className="ba-social-profile">
          <div className="ba-social-head"><div className="ba-social-avatar">MN</div><div><b>mi_negocio_oficial</b><small>137 publicaciones · 824 seguidores</small></div></div>
          <p>Servicios varios ✨ Cotizaciones por DM<br />Horario? pregunta por mensaje<br />📍 ubicación en historias</p>
          <span className="ba-broken-link">linktr.ee/mi-negocio-error</span>
          <div className="ba-story-row"><i /><i /><i /><i /></div>
          <div className="ba-post-grid"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
        </div>
      </div>
      <div className="ba-problem-tag ba-problem-tag--one"><Share2 size={12} /><span><b>Información dispersa</b><small>Cada dato vive en otro lugar</small></span></div>
      <div className="ba-problem-tag ba-problem-tag--two"><Search size={12} /><span><b>¿Cómo contacto?</b><small>No existe una acción clara</small></span></div>
      <div className="ba-problem-tag ba-problem-tag--three"><Clock3 size={12} /><span><b>Respuesta manual</b><small>El cliente tiene que esperar</small></span></div>
    </div>
  );
}

function AfterMockup({ siteRef }: { siteRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="ba-after-scene" aria-hidden="true">
      <div className="ba-site" ref={siteRef}>
        <div className="ba-browser"><div><i /><i /><i /></div><span><LockKeyhole size={8} /> www.punto-norte.mx</span><b>Demostración conceptual</b></div>
        <nav className="ba-site-nav"><strong>Punto Norte<i>.</i></strong><div><span>Inicio</span><span>Servicios</span><span>Experiencia</span><span>Contacto</span></div><b>Solicitar asesoría <ArrowRight size={8} /></b></nav>
        <main>
          <section className="ba-site-hero">
            <div><small><i /> Consultoría empresarial</small><h3>Decisiones firmes para hacer avanzar tu empresa.</h3><p>Estrategia, experiencia y acompañamiento especializado para convertir retos complejos en una ruta clara.</p><div><b>Solicitar asesoría <ArrowRight size={8} /></b><span>Conocer servicios</span></div><em><Check size={8} /> Primera orientación sin compromiso</em></div>
            <aside><div className="ba-hero-visual"><span /><span /><i /></div><div className="ba-consult-card"><CalendarCheck size={12} /><span><small>Próxima sesión</small><strong>Hoy · 4:30 PM</strong></span></div><div className="ba-result-card"><Sparkles size={11} /><span><b>Ruta clara</b><small>Recomendaciones accionables</small></span></div></aside>
          </section>
          <section className="ba-site-trust">{[[ShieldCheck, "Atención especializada"], [Clock3, "Respuesta ágil"], [MessageCircle, "Comunicación directa"]].map(([Icon, label]) => { const ItemIcon = Icon as typeof ShieldCheck; return <span key={String(label)}><ItemIcon size={9} /> {String(label)}</span>; })}</section>
          <section className="ba-site-services"><div><small>Nuestros servicios</small><strong>Experiencia aplicada a cada decisión.</strong></div><div>{[[BriefcaseBusiness, "Estrategia empresarial"], [ShieldCheck, "Cumplimiento y control"], [Sparkles, "Acompañamiento ejecutivo"]].map(([Icon, label], index) => { const ItemIcon = Icon as typeof BriefcaseBusiness; return <article key={String(label)}><span>0{index + 1}</span><ItemIcon size={11} /><strong>{String(label)}</strong><small>Una solución clara y enfocada en resultados.</small></article>; })}</div></section>
          <section className="ba-site-authority"><div><small>Una relación basada en confianza</small><strong>Experiencia que se convierte en decisiones accionables.</strong></div><div><span><b>01</b>Escuchamos</span><span><b>02</b>Diseñamos</span><span><b>03</b>Acompañamos</span></div></section>
          <section className="ba-site-cta"><div><small>Tu siguiente paso</small><strong>Comencemos con una conversación.</strong></div><span>Agendar llamada <ArrowRight size={8} /></span></section>
        </main>
        <footer className="ba-site-footer"><strong>Punto Norte.</strong><span><MapPin size={7} /> Monterrey, México</span><span>Contacto</span><span>Aviso de privacidad</span></footer>
      </div>
    </div>
  );
}

export function BeforeAfter() {
  const [position, setPosition] = useState(INITIAL_POSITION);
  const [interacted, setInteracted] = useState(false);
  const siteRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);

  function markInteracted() {
    if (interacted) return;
    setInteracted(true);
    trackPreviewEvent("before_after_slider_used");
  }

  function setComparison(next: number) {
    setPosition(next);
    markInteracted();
  }

  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - .5) * 1.8;
    const y = ((event.clientY - bounds.top) / bounds.height - .5) * -1.4;
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => {
      siteRef.current?.style.setProperty("--ba-tilt-x", `${y}deg`);
      siteRef.current?.style.setProperty("--ba-tilt-y", `${x}deg`);
    });
  }

  function resetTilt() {
    siteRef.current?.style.setProperty("--ba-tilt-x", "0deg");
    siteRef.current?.style.setProperty("--ba-tilt-y", "0deg");
  }

  return (
    <figure className={`comparison ba-comparison ${interacted ? "is-used" : "is-idle"}`} style={{ "--split": `${position}%` } as React.CSSProperties}>
      <figcaption className="ba-toolbar"><span><MoveHorizontal size={13} /> Arrastra para ver la transformación</span><button type="button" onClick={() => { setPosition(INITIAL_POSITION); setInteracted(false); }}><RotateCcw size={12} /> Reiniciar</button></figcaption>
      <div className="ba-viewport" onPointerMove={tilt} onPointerLeave={resetTilt}>
        <div className="ba-layer ba-layer--before"><BeforeMockup /></div>
        <div className="ba-layer ba-layer--after"><AfterMockup siteRef={siteRef} /></div>
        <span className="ba-label ba-label--before">Antes</span><span className="ba-label ba-label--after">Después</span>
        {!interacted && <div className="ba-drag-hint"><MoveHorizontal size={13} /> Desliza para comparar</div>}
        <input type="range" min="8" max="92" value={position} aria-label="Comparar presencia digital antes y después" aria-valuetext={`${100 - position}% de la página profesional visible`} onChange={(event) => setComparison(Number(event.target.value))} />
        <div className="ba-handle" aria-hidden="true"><span>‹</span><span>›</span></div>
      </div>
      <div className="ba-mobile-tabs" role="tablist" aria-label="Elegir comparación"><button type="button" role="tab" aria-selected={position >= 50} className={position >= 50 ? "is-active" : ""} onClick={() => setComparison(88)}>Ver antes</button><button type="button" role="tab" aria-selected={position < 50} className={position < 50 ? "is-active" : ""} onClick={() => setComparison(12)}>Ver después</button></div>
      <p className="sr-only">La vista Antes representa un negocio dependiente de redes sociales y la vista Después una página empresarial completa.</p>
    </figure>
  );
}
