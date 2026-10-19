"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Copy, Loader2 } from "lucide-react";

type Issue = { field: string; message: string };
type ApiResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: string; details?: Issue[] };

async function callApi(endpoint: string, method: string, body: unknown): Promise<ApiResult> {
  try {
    const response = await fetch(endpoint, { method, headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(body ?? {}) });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) return { ok: false, error: String(data.error ?? `Error ${response.status}`), details: data.details as Issue[] | undefined };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "No se pudo conectar. Revisa tu conexión e intenta de nuevo." };
  }
}

export function ActionButton({ endpoint, body, label, confirm, variant = "secondary", method = "POST", disabled }: { endpoint: string; body?: unknown; label: string; confirm?: string; variant?: "primary" | "secondary" | "danger" | "ghost"; method?: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    setError(null);
    const result = await callApi(endpoint, method, body);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    startTransition(() => router.refresh());
  };
  const loading = busy || pending;
  return <span className="po-action"><button type="button" className={`po-btn po-btn--${variant}`} onClick={run} disabled={disabled || loading}>{loading ? <Loader2 size={14} className="po-spin" /> : null}{label}</button>{error ? <small role="alert">{error}</small> : null}</span>;
}

export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "email" | "url" | "select" | "textarea" | "checkbox" | "datetime" | "json";
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean | null;
  help?: string;
  min?: number;
  max?: number;
  step?: number;
  wide?: boolean;
  /** Convierte el valor de un select a número. */
  numeric?: boolean;
};

function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let node = target;
  for (const part of parts.slice(0, -1)) node = (node[part] ??= {}) as Record<string, unknown>;
  node[parts[parts.length - 1]] = value;
}

function readForm(form: HTMLFormElement, fields: Field[], extra: Record<string, unknown>) {
  const body: Record<string, unknown> = structuredClone(extra);
  const data = new FormData(form);
  for (const field of fields) {
    const raw = data.get(field.name);
    if (field.type === "checkbox") {
      setPath(body, field.name, raw === "on");
      continue;
    }
    const text = typeof raw === "string" ? raw.trim() : "";
    if (field.type === "json") {
      if (text) setPath(body, field.name, JSON.parse(text));
      continue;
    }
    if (!text) {
      if (field.type === "number") setPath(body, field.name, null);
      continue;
    }
    if (field.type === "number" || field.numeric) setPath(body, field.name, Number(text));
    else if (field.type === "datetime") setPath(body, field.name, new Date(text).toISOString());
    else setPath(body, field.name, text);
  }
  return body;
}

export function JsonForm({ endpoint, fields, submitLabel, method = "POST", extra = {}, resultMode = "refresh", redirectBase, compact, confirm }: { endpoint: string; fields: Field[]; submitLabel: string; method?: string; extra?: Record<string, unknown>; resultMode?: "refresh" | "show" | "redirect"; redirectBase?: string; compact?: boolean; confirm?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirm && !window.confirm(confirm)) return;
    setError(null);
    let body: Record<string, unknown>;
    try {
      body = readForm(event.currentTarget, fields, extra);
    } catch {
      return setError("El JSON no es válido.");
    }
    setBusy(true);
    const response = await callApi(endpoint, method, body);
    setBusy(false);
    if (!response.ok) return setError(response.details?.length ? `${response.error} ${response.details.map((d) => `${d.field || "campo"}: ${d.message}`).join(" · ")}` : response.error);
    setResult(response.data);
    if (resultMode === "redirect" && redirectBase && typeof response.data.id === "string" && response.data.id) return router.push(`${redirectBase}${response.data.id}`);
    if (resultMode !== "show") event.currentTarget?.reset?.();
    startTransition(() => router.refresh());
  };
  const loading = busy || pending;
  return (
    <form className={`po-form${compact ? " po-form--compact" : ""}`} onSubmit={submit}>
      <div className="po-form__grid">
        {fields.map((field) => <FieldInput key={field.name} field={field} />)}
      </div>
      <div className="po-form__footer">
        <button type="submit" className="po-btn po-btn--primary" disabled={loading}>{loading ? <Loader2 size={14} className="po-spin" /> : null}{submitLabel}</button>
        {error ? <small role="alert" className="po-error">{error}</small> : null}
        {result && resultMode !== "redirect" ? <ResultSummary data={result} /> : null}
      </div>
    </form>
  );
}

function FieldInput({ field }: { field: Field }) {
  const id = `f-${field.name.replace(/\W/g, "-")}`;
  const common = { id, name: field.name, required: field.required, placeholder: field.placeholder };
  const defaultValue = field.defaultValue === null || field.defaultValue === undefined ? undefined : String(field.defaultValue);
  let control: React.ReactNode;
  if (field.type === "select") control = <select {...common} defaultValue={defaultValue}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
  else if (field.type === "textarea" || field.type === "json") control = <textarea {...common} defaultValue={defaultValue} rows={field.type === "json" ? 8 : 6} spellCheck={field.type !== "json"} />;
  else if (field.type === "checkbox") control = <input id={id} name={field.name} type="checkbox" defaultChecked={Boolean(field.defaultValue)} />;
  else control = <input {...common} type={field.type === "datetime" ? "datetime-local" : field.type ?? "text"} defaultValue={defaultValue} min={field.min} max={field.max} step={field.step} inputMode={field.type === "number" ? "decimal" : undefined} />;
  return <label htmlFor={id} className={`po-field${field.type === "checkbox" ? " po-field--check" : ""}${field.wide || field.type === "textarea" || field.type === "json" ? " po-field--wide" : ""}`}><span>{field.label}{field.required ? " *" : ""}</span>{control}{field.help ? <small>{field.help}</small> : null}</label>;
}

function ResultSummary({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([key, value]) => ["string", "number", "boolean"].includes(typeof value) && key !== "id");
  if (data.url) return <CopyBlock label="Enlace privado (se muestra una sola vez)" text={String(data.url)} />;
  return entries.length ? <small className="po-ok">{entries.map(([key, value]) => `${key}: ${value}`).join(" · ")}</small> : <small className="po-ok">Guardado.</small>;
}

export function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return <div className="po-copy"><div><span>{label}</span><button type="button" className="po-btn po-btn--ghost" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copiado" : "Copiar"}</button></div><pre>{text}</pre></div>;
}

/** Preparación de envío manual: muestra el texto final con enlace nuevo; no envía nada. */
export function PrepareSend({ messageId }: { messageId: string }) {
  const [prepared, setPrepared] = useState<{ recipient: string; subject: string | null; body: string; linkExpiresAt: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const prepare = async () => {
    setBusy(true);
    setError(null);
    const result = await callApi(`/api/prospect/messages/${messageId}/prepare`, "POST", {});
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setPrepared(result.data as typeof prepared);
  };
  if (!prepared) return <span className="po-action"><button type="button" className="po-btn po-btn--primary" onClick={prepare} disabled={busy}>{busy ? <Loader2 size={14} className="po-spin" /> : null}Preparar texto para envío manual</button>{error ? <small role="alert">{error}</small> : null}</span>;
  return (
    <div className="po-prepared">
      <CopyBlock label={`Destinatario`} text={prepared.recipient} />
      {prepared.subject ? <CopyBlock label="Asunto" text={prepared.subject} /> : null}
      <CopyBlock label={`Mensaje${prepared.linkExpiresAt ? ` · enlace vigente hasta ${new Date(prepared.linkExpiresAt).toLocaleDateString("es-MX")}` : ""}`} text={prepared.body} />
      <p className="po-muted">Envía el mensaje tú mismo desde el canal autorizado. Después registra el envío: el sistema no envía mensajes.</p>
      <ActionButton endpoint={`/api/prospect/messages/${messageId}/sent`} label="Registrar que lo envié" variant="primary" confirm="¿Confirmas que enviaste este mensaje manualmente?" />
    </div>
  );
}
