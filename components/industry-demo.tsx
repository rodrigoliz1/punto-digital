"use client";

import { useState } from "react";
import { ArrowRight, Monitor, Moon, Smartphone, Sun, Tablet } from "lucide-react";
import { INDUSTRIES } from "@/config/site";

type Device = "desktop" | "tablet" | "mobile";

export function IndustryDemo() {
  const [industry, setIndustry] = useState<(typeof INDUSTRIES)[number]>(INDUSTRIES[0]);
  const [device, setDevice] = useState<Device>("desktop");
  const [dark, setDark] = useState(false);

  return (
    <div className="industry-demo" style={{ "--demo-color": industry.color, "--demo-accent": industry.accent } as React.CSSProperties}>
      <div className="industry-controls">
        <div className="industry-list" role="list" aria-label="Selecciona una industria">
          {INDUSTRIES.map((item) => <button className={item.slug === industry.slug ? "is-active" : ""} key={item.slug} onClick={() => setIndustry(item)}>{item.name}</button>)}
        </div>
        <div className="device-controls" aria-label="Controles de demostración">
          <div>
            <button className={device === "desktop" ? "is-active" : ""} onClick={() => setDevice("desktop")} aria-label="Vista escritorio"><Monitor size={17} /></button>
            <button className={device === "tablet" ? "is-active" : ""} onClick={() => setDevice("tablet")} aria-label="Vista tablet"><Tablet size={17} /></button>
            <button className={device === "mobile" ? "is-active" : ""} onClick={() => setDevice("mobile")} aria-label="Vista móvil"><Smartphone size={17} /></button>
          </div>
          <button onClick={() => setDark(!dark)} aria-label="Alternar modo de color">{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
        </div>
      </div>

      <div className={`device-stage device-stage--${device}`}>
        <div className={`device ${dark ? "device--dark" : ""}`}>
          <div className="device-camera" />
          <div className="demo-page">
            <nav><strong>{industry.name.split(" ")[0]}<span>.</span></strong><div><i /><i /><button>Contacto</button></div></nav>
            <main>
              <div className="demo-copy"><small>{industry.service}</small><h3>{industry.headline}</h3><p>Una experiencia creada para transmitir confianza y convertir visitas en conversaciones.</p><button>Conocer más <ArrowRight size={14} /></button></div>
              <div className="demo-art"><span className="demo-art-ring" /><span className="demo-art-card card-a" /><span className="demo-art-card card-b" /><span className="demo-art-dot" /></div>
            </main>
            <footer><span>Experiencia</span><span>Claridad</span><span>Resultados</span></footer>
          </div>
        </div>
        <div className="device-shadow" />
      </div>
      <p className="demo-disclaimer">Demostración conceptual. El diseño final se personaliza para cada negocio.</p>
    </div>
  );
}
