import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_LABELS, type ProspectStatus } from "@/lib/prospect/types";

export const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
export const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);
export const usd = (micros: number) => `US$${(micros / 1_000_000).toFixed(2)}`;
export function date(value: string | null | undefined, withTime = false) {
  if (!value) return "—";
  const parsed = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
}

const STATUS_TONE: Record<string, string> = {
  discovered: "neutral", qualified: "blue", demo_ready: "violet", approved: "teal", contacted: "amber", replied: "amber", meeting: "violet", won: "green", lost: "neutral", suppressed: "red",
  draft: "neutral", sent: "green", discarded: "neutral", revoked: "red", superseded: "neutral", reviewed: "teal", active: "green", paused: "amber", closed: "neutral", running: "amber", succeeded: "green", failed: "red",
};

const GENERIC_LABELS: Record<string, string> = { draft: "Borrador", approved: "Aprobado", sent: "Enviado (manual)", discarded: "Descartado", revoked: "Revocada", superseded: "Reemplazada", reviewed: "Revisado", active: "Activa", paused: "Pausada", closed: "Cerrada" };

export function Badge({ status, label }: { status: string; label?: string }) {
  const text = label ?? STATUS_LABELS[status as ProspectStatus] ?? GENERIC_LABELS[status] ?? status;
  return <span className={`po-badge po-badge--${STATUS_TONE[status] ?? "neutral"}`}>{text}</span>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: ReactNode }) {
  return <div className="po-header"><div><span>{eyebrow}</span><h1>{title}</h1>{description ? <p>{description}</p> : null}</div>{actions ? <div className="po-header__actions">{actions}</div> : null}</div>;
}

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: string; href?: string }) {
  const body = <><span>{label}</span><strong>{value}</strong>{hint ? <small>{hint}</small> : null}</>;
  return href ? <Link href={href} className="po-stat po-stat--link">{body}</Link> : <div className="po-stat">{body}</div>;
}

export function Panel({ title, description, actions, children, id }: { title: string; description?: string; actions?: ReactNode; children: ReactNode; id?: string }) {
  return <section className="po-panel" id={id}><header><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>{actions}</header><div className="po-panel__body">{children}</div></section>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="po-empty"><strong>{title}</strong>{children ? <p>{children}</p> : null}</div>;
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return <div className="po-table-wrap"><table className="po-table"><thead><tr>{head.map((cell) => <th key={cell}>{cell}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

export function ScoreBar({ score }: { score: number }) {
  return <span className="po-score" title={`${score}/100`}><i style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /><b>{score}</b></span>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "danger"; children: ReactNode }) {
  return <div className={`po-notice po-notice--${tone}`} role="note">{children}</div>;
}

export function KeyValue({ items }: { items: Array<[string, ReactNode]> }) {
  return <dl className="po-kv">{items.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value ?? "—"}</dd></div>)}</dl>;
}

export function ExternalLink({ href, children }: { href: string | null | undefined; children?: ReactNode }) {
  if (!href || !/^https?:\/\//i.test(href)) return <>—</>;
  return <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="po-link">{children ?? href.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48)}</a>;
}
