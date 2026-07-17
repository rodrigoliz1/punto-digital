"use client";

import { useState } from "react";
import { Check, Search, Share2, Sparkles } from "lucide-react";

export function BeforeAfter() {
  const [position, setPosition] = useState(55);
  return (
    <div className="comparison" style={{ "--split": `${position}%` } as React.CSSProperties}>
      <div className="comparison-layer comparison-before">
        <div className="messy-profile">
          <div className="messy-avatar" />
          <div><b>mi_negocio_oficial</b><small>Información • links • promos • ubicación???</small></div>
          <div className="messy-posts"><i /><i /><i /><i /><i /><i /></div>
          <div className="floating-tag tag-one"><Share2 size={14} /> Link roto</div>
          <div className="floating-tag tag-two"><Search size={14} /> ¿Dónde contacto?</div>
        </div>
        <span className="comparison-label">Antes</span>
      </div>
      <div className="comparison-layer comparison-after">
        <div className="clean-site">
          <div className="clean-nav"><strong>Punto Norte<span>.</span></strong><i /><i /><button>Contactar</button></div>
          <div className="clean-hero"><span>Servicios profesionales</span><h3>Claridad para tomar mejores decisiones.</h3><p>Todo lo que necesitas saber, en un solo lugar.</p><button>Conoce nuestros servicios</button></div>
          <div className="clean-benefits"><span><Check size={14} /> Claro</span><span><Check size={14} /> Confiable</span><span><Sparkles size={14} /> Memorable</span></div>
        </div>
        <span className="comparison-label">Después</span>
      </div>
      <input aria-label="Comparar antes y después" type="range" min="10" max="90" value={position} onChange={(event) => setPosition(Number(event.target.value))} />
      <div className="comparison-handle" aria-hidden="true"><span>‹</span><span>›</span></div>
    </div>
  );
}
