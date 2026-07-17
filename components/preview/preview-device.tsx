"use client";

import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import { slugifyBusinessName } from "@/lib/preview-engine";
import type { PreviewDevice as Device, PreviewTemplate } from "@/types";

type PreviewDeviceProps = {
  device: Device;
  template: PreviewTemplate;
  businessName: string;
  updating: boolean;
  children: ReactNode;
  fullscreen?: boolean;
};

export function PreviewDevice({ device, template, businessName, updating, children, fullscreen = false }: PreviewDeviceProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const url = slugifyBusinessName(businessName);
  const style = {
    "--pv-primary": template.palette.primary,
    "--pv-accent": template.palette.accent,
    "--pv-bg": template.palette.background,
    "--pv-surface": template.palette.surface,
    "--pv-soft": template.palette.soft,
    "--pv-text": template.palette.text,
    "--pv-muted": template.palette.muted,
    "--pv-border": template.palette.border,
    "--pv-on-primary": template.palette.onPrimary,
    "--pv-heading": template.typography.heading,
    "--pv-body": template.typography.body,
  } as CSSProperties;

  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const node = shellRef.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - .5) * 1.3;
    const y = ((event.clientY - bounds.top) / bounds.height - .5) * -1.1;
    node.style.setProperty("--pv-tilt-x", `${y}deg`);
    node.style.setProperty("--pv-tilt-y", `${x}deg`);
  }

  function resetTilt() {
    shellRef.current?.style.setProperty("--pv-tilt-x", "0deg");
    shellRef.current?.style.setProperty("--pv-tilt-y", "0deg");
  }

  return (
    <div className={`pd-device-stage pd-device-stage--${device} ${fullscreen ? "is-fullscreen" : ""}`} onPointerMove={tilt} onPointerLeave={resetTilt} style={style}>
      <div ref={shellRef} className={`pd-device pd-device--${device}`} aria-busy={updating}>
        {device === "mobile" && <div className="pd-device__notch" aria-hidden="true" />}
        <div className="pd-browser-bar" aria-hidden="true">
          <div className="pd-browser-dots"><i /><i /><i /></div>
          <div className="pd-browser-tab"><span>{businessName || "Tu negocio"}</span></div>
          <div className="pd-browser-url"><LockKeyhole size={9} /><span>www.{url}</span></div>
          <i className="pd-browser-more" />
        </div>
        <div className={`pd-preview-canvas industry-${template.industry} theme-${template.visualTheme} nav-${template.navigationVariant} hero-${template.heroVariant} cards-${template.cardVariant} form-${template.formVariant} testimonial-${template.testimonialVariant} products-${template.productVariant} dashboard-${template.dashboardVariant} footer-${template.footerVariant}`}>
          {children}
        </div>
        <div className={`pd-preview-updating ${updating ? "is-visible" : ""}`} role="status" aria-live="polite">
          <span className="pd-preview-loader"><i /><i /><i /></span>
          <strong>Actualizando tu propuesta…</strong>
          <small>Adaptando estructura, contenido y estilo</small>
        </div>
      </div>
      <div className="pd-device-shadow" aria-hidden="true" />
    </div>
  );
}
