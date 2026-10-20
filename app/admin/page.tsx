import type { Metadata } from "next";
import { requireAdminAccess } from "@/app/access";
import { AdminDashboard } from "@/components/dashboard-shell";
import { prospectOsEnabled } from "@/lib/prospect/access";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administración", robots: { index: false, follow: false } };
export default async function AdminPage() { const user = await requireAdminAccess(); return <AdminDashboard userName={user.displayName} prospectOs={prospectOsEnabled()} />; }
