import type { Metadata } from "next";
import { AdminDashboard } from "@/components/dashboard-shell";
export const metadata: Metadata = { title: "Administración", robots: { index: false, follow: false } };
export default function AdminPage() { return <AdminDashboard />; }
