"use client";

import { useEffect, useState } from "react";

export function Preloader() {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("pd-intro-seen")) return;
    const show = window.setTimeout(() => setVisible(true), 0);
    const leave = window.setTimeout(() => setLeaving(true), 350);
    const hide = window.setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem("pd-intro-seen", "true");
    }, 650);
    return () => { window.clearTimeout(show); window.clearTimeout(leave); window.clearTimeout(hide); };
  }, []);

  if (!visible) return null;
  return (
    <div className={`preloader ${leaving ? "preloader--leaving" : ""}`} role="status" aria-label="Cargando Punto Digital">
      <button onClick={() => { setVisible(false); sessionStorage.setItem("pd-intro-seen", "true"); }}>Omitir introducción</button>
      <div className="preloader-orbit"><span /><span /><span /><span /></div>
      <div className="preloader-logo"><strong>Punto<span>.</span></strong> Digital</div>
    </div>
  );
}
