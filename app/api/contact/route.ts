import { z } from "zod";

const contactSchema = z.object({ name: z.string().min(2).max(120), email: z.string().email().max(160), phone: z.string().max(40).optional().default(""), message: z.string().min(10).max(4000), company: z.string().max(0).optional().default("") });

export async function POST(request: Request) {
  const parsed = contactSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Revisa los datos del formulario." }, { status: 400 });
  return Response.json({ id: crypto.randomUUID(), previewMode: true, saved: false }, { status: 202 });
}
