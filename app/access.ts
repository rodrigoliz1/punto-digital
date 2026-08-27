import { notFound, redirect } from "next/navigation";
import { chatGPTSignInPath, getChatGPTUser } from "@/app/chatgpt-auth";

export async function requireClientAccess(returnTo: string) {
  if (process.env.PRIVATE_SURFACES_ENABLED !== "true") notFound();
  const user = await getChatGPTUser();
  if (!user) redirect(chatGPTSignInPath(returnTo));
  return user;
}

export async function requireAdminAccess() {
  const user = await requireClientAccess("/admin");
  const allowed = (process.env.ADMIN_EMAIL ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.includes(user.email.toLowerCase())) notFound();
  return user;
}
