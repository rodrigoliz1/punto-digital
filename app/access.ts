import { notFound, redirect } from "next/navigation";
import { chatGPTSignInPath, getChatGPTUser } from "@/app/chatgpt-auth";
import { requireStaffPage } from "@/lib/auth/next";

/** Portal del cliente: identidad de la plataforma, solo si está declarada como confiable. */
export async function requireClientAccess(returnTo: string) {
  if (process.env.PRIVATE_SURFACES_ENABLED !== "true") notFound();
  const user = await getChatGPTUser();
  if (!user) redirect(chatGPTSignInPath(returnTo));
  return user;
}

/** Administración: sesión del equipo verificada en servidor (contraseña + TOTP), rol administrador o superior. */
export async function requireAdminAccess() {
  const identity = await requireStaffPage("/admin", "admin");
  return { email: identity.email, displayName: identity.email, role: identity.role };
}
