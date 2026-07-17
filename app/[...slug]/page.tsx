import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MarketingPage, getMarketingData } from "@/components/marketing-page";

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = getMarketingData(slug);
  if (!data) return {};
  return { title: data.eyebrow, description: data.description, alternates: { canonical: `/${slug.join("/")}` } };
}

export default async function CatchAllPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const data = getMarketingData(slug);
  if (!data) notFound();
  return <><SiteHeader /><MarketingPage data={data} slug={slug.join("/")} /><SiteFooter /></>;
}
