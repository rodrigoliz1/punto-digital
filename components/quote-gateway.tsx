"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, MessageCircle, MonitorSmartphone, X } from "lucide-react";

const WHATSAPP_NUMBER = "5216692122543";
const WHATSAPP_MESSAGE =
  "Hola Punto Digital, me interesa cotizar mi página web.";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

type GatewayChoice = "whatsapp" | "maqueta" | null;

function isQuoteHref(href: string): boolean {
  return /^\/cotizador(?:$|[?#])/.test(href);
}

export function QuoteGateway() {
  const [open, setOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState("/cotizador");
  const [leaving, setLeaving] = useState<GatewayChoice>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const origin = event.target as HTMLElement | null;
      const anchor = origin?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href") ?? "";
      if (!isQuoteHref(href)) return;

      event.preventDefault();
      event.stopPropagation();
      setPendingHref(href);
      setOpen(true);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && leaving === null) setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, leaving]);

  if (!open) return null;

  const choose = (choice: Exclude<GatewayChoice, null>) => {
    setLeaving(choice);
    closeTimer.current = window.setTimeout(() => {
      if (choice === "whatsapp") {
        window.open(WHATSAPP_URL, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = pendingHref;
      }
      setOpen(false);
      setLeaving(null);
    }, 520);
  };

  return (
    <div
      className={`quote-gateway ${leaving ? "quote-gateway--leaving" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quote-gateway-title"
    >
      <div className="quote-gateway__glow" aria-hidden="true" />
      <button
        type="button"
        className="quote-gateway__close"
        onClick={() => setOpen(false)}
        aria-label="Cerrar"
        disabled={leaving !== null}
      >
        <X size={20} />
      </button>

      <div className="quote-gateway__panel">
        <div className="quote-gateway__kicker">
          <span className="quote-gateway__dot" aria-hidden="true" />
          Tu siguiente paso
        </div>
        <h2 id="quote-gateway-title">¿Cómo quieres cotizar tu página?</h2>
        <p className="quote-gateway__lead">
          Elige la forma de avanzar que mejor se adapte a ti. En ambos casos te
          acompañamos de principio a fin.
        </p>

        <div className="quote-gateway__options">
          <button
            type="button"
            className={`quote-gateway__option quote-gateway__option--whatsapp ${leaving === "whatsapp" ? "is-leaving" : ""}`}
            onClick={() => choose("whatsapp")}
            disabled={leaving !== null}
          >
            <span className="quote-gateway__option-icon">
              <MessageCircle size={24} />
            </span>
            <span className="quote-gateway__option-number">01</span>
            <strong>Cotizar por Atención Directa</strong>
            <small>WhatsApp</small>
            <p>
              Escríbenos ahora y recibe atención personalizada al momento.
            </p>
            <span className="quote-gateway__option-action">
              Abrir WhatsApp <ArrowRight size={16} />
            </span>
          </button>

          <button
            type="button"
            className={`quote-gateway__option quote-gateway__option--maqueta ${leaving === "maqueta" ? "is-leaving" : ""}`}
            onClick={() => choose("maqueta")}
            disabled={leaving !== null}
          >
            <span className="quote-gateway__option-icon">
              <MonitorSmartphone size={24} />
            </span>
            <span className="quote-gateway__option-number">02</span>
            <strong>Maqueta Digital</strong>
            <small>Configurador interactivo</small>
            <p>
              Define tu proyecto y visualiza una maqueta preliminar antes de decidir.
            </p>
            <span className="quote-gateway__option-action">
              Continuar al configurador <ArrowRight size={16} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
