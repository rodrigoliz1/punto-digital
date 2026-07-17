import { z } from "zod";

const leadSchema = z.object({
  email: z.string().email().max(160),
  contactName: z.string().min(1).max(120),
  phone: z.string().max(40).optional().default(""),
  businessName: z.string().min(1).max(160),
  industry: z.string().max(100),
  projectType: z.string().max(60),
  selectedProduct: z.string().max(60),
  estimatedTotal: z.number().nonnegative(),
}).passthrough();

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 50_000) return Response.json({ error: "Solicitud demasiado grande." }, { status: 413 });
  const parsed = leadSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Revisa tu nombre y correo." }, { status: 400 });
  const id = crypto.randomUUID();
  return Response.json({ id, saved: false, previewMode: true }, { status: 202 });
}
