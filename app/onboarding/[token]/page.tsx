import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Información de tu proyecto", robots: { index: false, follow: false } };
export default async function OnboardingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) notFound();
  return <main className="state-page"><span>Acceso protegido</span><h1>Este onboarding aún no está habilitado.</h1><p>El enlace debe validarse contra un proyecto activo y una fecha de expiración en el servidor. Solicita un enlace nuevo al equipo de Punto Digital.</p></main>;
}
