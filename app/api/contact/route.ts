import { z } from "zod";
import { readJson, requireJsonRequest } from "@/lib/request-security";
import { getD1Binding } from "@/lib/runtime-bindings";

const contactSchema = z.object({ name: z.string().min(2).max(120), email: z.string().email().max(160), phone: z.string().max(40).optional().default(""), message: z.string().min(10).max(4000), company: z.string().max(0).optional().default("") });

export async function POST(request: Request) {
  const rejected = requireJsonRequest(request, 10_000);
  if (rejected) return rejected;
  const parsed = contactSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Revisa los datos del formulario." }, { status: 400 });
  if (parsed.data.company) return Response.json({ id: crypto.randomUUID(), accepted: true }, { status: 202 });
  const id = crypto.randomUUID();
  const db = getD1Binding();
  if (!db) return Response.json({ id, previewMode: true, saved: false }, { status: 202 });
  await db.prepare("INSERT INTO contact_messages (id, name, email, phone, message, status) VALUES (?, ?, ?, ?, ?, 'new')")
    .bind(id, parsed.data.name, parsed.data.email.toLowerCase(), parsed.data.phone || null, parsed.data.message)
    .run();
  return Response.json({ id, saved: true }, { status: 201 });
}
