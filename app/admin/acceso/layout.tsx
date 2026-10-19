import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../prospectos/prospect.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Acceso del equipo", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function AccessLayout({ children }: { children: React.ReactNode }) {
  if (process.env.PRIVATE_SURFACES_ENABLED !== "true") notFound();
  return <main className="po po-auth"><section className="po-auth__card">{children}</section></main>;
}
