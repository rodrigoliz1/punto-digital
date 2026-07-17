import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
export const metadata: Metadata = { title: "Compra segura", robots: { index: false, follow: false } };
export default function PurchasePage() { return <><SiteHeader /><main className="state-page"><ShieldCheck size={42} /><span>Compra segura</span><h1>Primero configura tu proyecto.</h1><p>Así podemos recalcular el precio en el servidor y mostrarte exactamente qué incluye antes de enviarte a Stripe.</p><Link className="button" href="/cotizador">Abrir configurador <ArrowRight size={17} /></Link><small><LockKeyhole size={14} /> Nunca confiamos en precios enviados por el navegador.</small></main><SiteFooter /></>; }
