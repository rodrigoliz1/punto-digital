"use client";

import { useRef, useState } from "react";
import { BarChart3, CalendarDays, Globe2, MessageCircle, ShoppingBag } from "lucide-react";

const nodes = [
  { label: "Página", icon: Globe2, className: "orbit-node--one" },
  { label: "WhatsApp", icon: MessageCircle, className: "orbit-node--two" },
  { label: "Pagos", icon: ShoppingBag, className: "orbit-node--three" },
  { label: "Citas", icon: CalendarDays, className: "orbit-node--four" },
  { label: "Analítica", icon: BarChart3, className: "orbit-node--five" },
];

export function DigitalOrbit() {
  const scene = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState("Página");

  function move(event: React.PointerEvent<HTMLDivElement>) {
    if (!scene.current) return;
    const rect = scene.current.getBoundingClientRect();
    const rx = ((event.clientY - rect.top) / rect.height - 0.5) * -12;
    const ry = ((event.clientX - rect.left) / rect.width - 0.5) * 14;
    scene.current.style.setProperty("--rx", `${rx}deg`);
    scene.current.style.setProperty("--ry", `${ry}deg`);
  }

  return (
    <div className="orbit-stage" onPointerMove={move} onPointerLeave={() => { scene.current?.style.setProperty("--rx", "0deg"); scene.current?.style.setProperty("--ry", "0deg"); }}>
      <div className="orbit-glow" />
      <div className="orbit-scene" ref={scene}>
        <div className="orbit-ring orbit-ring--one" />
        <div className="orbit-ring orbit-ring--two" />
        <div className="orbit-core"><span /><strong>Tu<br />negocio</strong></div>
        {nodes.map(({ label, icon: Icon, className }) => (
          <button key={label} className={`orbit-node ${className} ${active === label ? "is-active" : ""}`} onClick={() => setActive(label)} aria-label={`Ver función de ${label}`}>
            <Icon size={17} /><span>{label}</span>
          </button>
        ))}
      </div>
      <div className="orbit-caption"><span>Idea</span><i /><span>Identidad</span><i /><span>Página</span><i /><strong>{active}</strong></div>
    </div>
  );
}
