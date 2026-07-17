import { env } from "cloudflare:workers";
import { z } from "zod";

const contactSchema = z.object({ name: z.string().min(2).max(120), email: z.string().email().max(160), phone: z.string().max(40).optional().default(""), message: z.string().min(10).max(4000), company: z.string().max(0).optional().default("") });

export async function POST(request: Request) {
  const parsed = contactSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Revisa los datos del formulario." }, { status: 400 });
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS contact_messages (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, deleted_at TEXT)`).run();
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO contact_messages (id, name, email, phone, message) VALUES (?, ?, ?, ?, ?)").bind(id, parsed.data.name, parsed.data.email, parsed.data.phone, parsed.data.message).run();
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    console.error("contact_insert_failed", error);
    return Response.json({ error: "No pudimos guardar el mensaje." }, { status: 500 });
  }
}
