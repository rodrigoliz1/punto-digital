import Link from "next/link";
import { EnrollForm } from "@/components/auth/forms";

export const metadata = { title: "Activar acceso" };

export default async function EnrollPage({ searchParams }: { searchParams: Promise<{ email?: string; token?: string }> }) {
  const { email = "", token = "" } = await searchParams;
  return (
    <>
      <span className="po-auth__brand">Punto<b>.</b> Digital · Equipo</span>
      <h1>Activar acceso</h1>
      <p>Configura tu contraseña y tu segundo factor. El enlace es personal, de un solo uso y vence en 72 horas.</p>
      <EnrollForm email={email.slice(0, 160)} token={token.slice(0, 200)} />
      <p className="po-muted"><Link className="po-link" href="/admin/acceso">Volver a iniciar sesión</Link></p>
    </>
  );
}
