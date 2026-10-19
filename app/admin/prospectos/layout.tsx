import type { Metadata } from "next";
import { ProspectShell } from "@/components/prospect/shell";
import { requireProspectPage } from "@/lib/prospect/access";
import { ROLE_LABELS } from "@/lib/prospect/types";
import "./prospect.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Prospect OS", template: "%s · Prospect OS" }, robots: { index: false, follow: false } };

export default async function ProspectLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireProspectPage("/admin/prospectos");
  return <ProspectShell email={ctx.actor.email} roleLabel={ROLE_LABELS[ctx.actor.role]}>{children}</ProspectShell>;
}
