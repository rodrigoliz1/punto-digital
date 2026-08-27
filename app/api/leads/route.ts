import { z } from "zod";
import { calculateQuote } from "@/config/products";
import { readJson, requireJsonRequest } from "@/lib/request-security";
import { getD1Binding } from "@/lib/runtime-bindings";

const leadSchema = z.object({
  email: z.string().email().max(160),
  contactName: z.string().min(1).max(120),
  phone: z.string().max(40).optional().default(""),
  businessName: z.string().min(1).max(160),
  industry: z.string().max(100),
  projectType: z.string().max(60),
  selectedProduct: z.enum(["esencial", "profesional", "tienda", "medida"]),
  selectedAddons: z.array(z.string()).max(12).default([]),
}).strict();

export async function POST(request: Request) {
  const rejected = requireJsonRequest(request);
  if (rejected) return rejected;
  const parsed = leadSchema.safeParse(await readJson(request));
  if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  console.error("Lead validation failed:", issues);
  return Response.json({ error: "Revisa los datos del formulario. Algunos campos están incompletos o son incorrectos.", details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) }, { status: 400 });
}
  const quote = calculateQuote(parsed.data.selectedProduct, parsed.data.selectedAddons);
  const id = crypto.randomUUID();
  const db = getD1Binding();
  if (!db) return Response.json({ id, estimatedTotal: quote.total, saved: false, previewMode: true }, { status: 202 });
  await db.prepare("INSERT INTO leads (id, email, contact_name, phone, business_name, industry, project_type, selected_product, estimated_total, payload, status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', 'configurator')")
    .bind(id, parsed.data.email.toLowerCase(), parsed.data.contactName, parsed.data.phone || null, parsed.data.businessName, parsed.data.industry, parsed.data.projectType, parsed.data.selectedProduct, quote.total, JSON.stringify({ selectedAddons: quote.addons.map((addon) => addon.slug) }))
    .run();
  return Response.json({ id, estimatedTotal: quote.total, saved: true }, { status: 201 });
}
