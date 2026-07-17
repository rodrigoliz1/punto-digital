"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Check, X } from "lucide-react";

type PreviewFullscreenProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  onApprove: () => void;
  children: ReactNode;
};

export function PreviewFullscreen({ open, title, onClose, onApprove, children }: PreviewFullscreenProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      previousFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      document.body.style.overflow = "hidden";
      window.setTimeout(() => closeRef.current?.focus(), 0);
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function close() {
    document.body.style.overflow = "";
    onClose();
    window.setTimeout(() => previousFocus.current?.focus(), 0);
  }

  return (
    <dialog ref={dialogRef} className="pd-preview-fullscreen" aria-labelledby="preview-fullscreen-title" onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => { document.body.style.overflow = ""; }}>
      <header className="pd-preview-fullscreen__header">
        <div><small>Demostración interactiva</small><strong id="preview-fullscreen-title">{title}</strong></div>
        <button ref={closeRef} type="button" onClick={close} aria-label="Cerrar pantalla completa"><X size={19} /></button>
      </header>
      <div className="pd-preview-fullscreen__content">{children}</div>
      <div className="pd-preview-fullscreen__approve"><span>¿Esta dirección representa lo que imaginas?</span><button type="button" onClick={onApprove}><Check size={16} /> Me gusta esta dirección visual</button></div>
    </dialog>
  );
}
