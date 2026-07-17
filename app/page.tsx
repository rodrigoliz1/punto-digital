import type { Metadata } from "next";
import { HomePage } from "@/components/home-page";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: { absolute: "Punto Digital | Páginas web profesionales para negocios" },
  description: "Diseñamos páginas web profesionales, rápidas y preparadas para convertir visitas en clientes.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return <><SiteHeader /><HomePage /><SiteFooter /></>;
}
