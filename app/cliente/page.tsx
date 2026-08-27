import type { Metadata } from "next";
import { requireClientAccess } from "@/app/access";
import { ClientDashboard } from "@/components/dashboard-shell";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portal del cliente", robots: { index: false, follow: false } };
export default async function ClientPage() { const user = await requireClientAccess("/cliente"); return <ClientDashboard userName={user.displayName} />; }
