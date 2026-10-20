import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/forms";
import { Notice } from "@/components/prospect/ui";
import { authEnv, safeNextPath, staffForPage } from "@/lib/auth/next";
import { authConfigured } from "@/lib/auth/staff";

export const metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  if (await staffForPage()) redirect(next);
  return (
    <>
      <span className="po-auth__brand">Punto<b>.</b> Digital · Equipo</span>
      <h1>Iniciar sesión</h1>
      <p>Acceso restringido al equipo. Se requiere contraseña y código de tu app de autenticación.</p>
      {authConfigured(authEnv()) ? <LoginForm next={next} /> : <Notice tone="danger">La autenticación no está configurada: falta AUTH_SECRET (mínimo 32 caracteres).</Notice>}
      <p className="po-muted">¿Recibiste una invitación? <Link className="po-link" href="/admin/acceso/activar">Activa tu acceso</Link>.</p>
    </>
  );
}
