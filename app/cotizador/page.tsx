import type { Metadata } from "next";
import { QuoteConfigurator } from "@/components/quote-configurator";

export const metadata: Metadata = { title: "Configura y cotiza tu página", description: "Define tu proyecto, visualiza una dirección preliminar y recibe una estimación transparente.", alternates: { canonical: "/cotizador" } };

export default function QuotePage() { return <QuoteConfigurator />; }
