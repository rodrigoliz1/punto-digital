"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "preview" | "error">("idle");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    const data = await response.json() as { previewMode?: boolean };
    setStatus(response.ok ? data.previewMode ? "preview" : "done" : "error");
  }
  if (status === "done") return <div className="contact-success"><CheckCircle2 size={32} /><h3>Mensaje recibido.</h3><p>Gracias por contarnos sobre tu proyecto. Te responderemos por el medio que indicaste.</p></div>;
  if (status === "preview") return <div className="contact-success"><CheckCircle2 size={32} /><h3>Demostración completada.</h3><p>Este sitio es una vista preliminar. Conectaremos la recepción de mensajes antes de publicarlo oficialmente.</p></div>;
  return <form className="contact-form" onSubmit={submit}><label><span>Nombre</span><input name="name" required /></label><label><span>Correo</span><input name="email" type="email" required /></label><label><span>WhatsApp</span><input name="phone" /></label><label><span>Cuéntanos qué necesitas</span><textarea name="message" rows={5} required /></label><label className="consent"><input type="checkbox" required /> Acepto el tratamiento de mis datos para recibir respuesta.</label><input name="company" tabIndex={-1} autoComplete="off" className="honeypot" aria-hidden="true" /><button className="button" disabled={status === "loading"}>{status === "loading" ? <Loader2 className="spin" size={18} /> : <Send size={18} />}Enviar mensaje</button>{status === "error" && <p className="form-error">No pudimos enviar el mensaje. Intenta de nuevo.</p>}</form>;
}
