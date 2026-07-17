import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import { headers } from "next/headers";
import { SITE } from "@/config/site";
import "./globals.css";
import "./site.css";
import "./product.css";
import "./responsive.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const viewport: Viewport = { themeColor: "#061326", colorScheme: "light" };

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : SITE.url;
  const socialImage = `${origin}/og.png`;
  return {
    metadataBase: new URL(origin),
    title: { default: "Punto Digital | Tu punto de partida digital", template: "%s | Punto Digital" },
    description: SITE.description,
    applicationName: SITE.name,
    alternates: { canonical: "/" },
    icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon.ico" }], apple: "/apple-touch-icon.png" },
    manifest: "/manifest.webmanifest",
    openGraph: { type: "website", locale: "es_MX", siteName: SITE.name, title: "Punto Digital — Tu punto de partida digital", description: SITE.description, url: origin, images: [{ url: socialImage, width: 1200, height: 630, alt: "Punto Digital — páginas web profesionales" }] },
    twitter: { card: "summary_large_image", title: "Punto Digital — Tu punto de partida digital", description: SITE.description, images: [socialImage] },
  };
}

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
    <html lang="es" className={`${manrope.variable} ${inter.variable}`}>
      <body>
        <a href="#contenido" className="skip-link">Saltar al contenido</a>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </body>
    </html>
  );
}
