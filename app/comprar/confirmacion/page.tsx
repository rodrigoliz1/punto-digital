import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
export const metadata: Metadata = { title: "Solicitud confirmada", robots: { index: false, follow: false } };
export default function ConfirmationPage() { return <main className="state-page state-page--success"><CheckCircle2 size={50} /><span>Confirmación</span><h1>Tu proyecto ya tiene un punto de partida.</h1><p>Recibimos tu solicitud. Si este recorrido se ejecutó sin credenciales de Stripe, se trata de una confirmación de demostración y no se realizó ningún cargo.</p><div><Link className="button" href="/onboarding/demo-project-token">Completar información <ArrowRight size={17} /></Link><Link className="button button--outline" href="/">Volver al inicio</Link></div></main>; }
