import type { Metadata } from "next";
import { OnboardingForm } from "@/components/onboarding-form";

export const metadata: Metadata = { title: "Información de tu proyecto", robots: { index: false, follow: false } };
export default async function OnboardingPage({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; return <OnboardingForm token={token} />; }
