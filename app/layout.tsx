import type { Metadata, Viewport } from "next";
import { SITE } from "@/config/site";
import { QuoteGateway } from "@/components/quote-gateway";
import "./globals.css";
import "./site.css";
import "./product.css";
import "./responsive.css";
import "./preview.css";
import "./comparison.css";

export const viewport: Viewport = { themeColor: "#061326", colorScheme: "light" };

export const metadata: Metadata = {
    metadataBase: new URL(SITE.url),
    title: { default: "Punto Digital | Tu punto de partida digital", template: "%s | Punto Digital" },
    description: SITE.description,
    applicationName: SITE.name,
    alternates: { canonical: "/" },
    icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon.ico" }], apple: "/apple-touch-icon.png" },
    manifest: "/manifest.webmanifest",
    openGraph: { type: "website", locale: "es_MX", siteName: SITE.name, title: "Punto Digital — Tu punto de partida digital", description: SITE.description, url: SITE.url, images: [{ url: "/og.png", width: 1200, height: 630, alt: "Punto Digital — páginas web profesionales" }] },
    twitter: { card: "summary_large_image", title: "Punto Digital — Tu punto de partida digital", description: SITE.description, images: ["/og.png"] },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE.name,
  url: SITE.url,
  logo: `${SITE.url}/brand/logo-horizontal.svg`,
  description: SITE.description,
  areaServed: { "@type": "Country", name: "México" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <a href="#contenido" className="skip-link">Saltar al contenido</a>
        {children}
        <QuoteGateway />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </body>
    </html>
  );
}
