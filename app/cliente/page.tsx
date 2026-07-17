import type { Metadata } from "next";
import { ClientDashboard } from "@/components/dashboard-shell";
export const metadata: Metadata = { title: "Portal del cliente", robots: { index: false, follow: false } };
export default function ClientPage() { return <ClientDashboard />; }
