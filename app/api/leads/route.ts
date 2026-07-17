import { env } from "cloudflare:workers";
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
  const data = parsed.data;
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, email TEXT NOT NULL, contact_name TEXT NOT NULL, phone TEXT, business_name TEXT NOT NULL, industry TEXT, project_type TEXT, selected_product TEXT, estimated_total REAL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', source TEXT NOT NULL DEFAULT 'configurator', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, deleted_at TEXT)`).run();
    await env.DB.prepare("INSERT INTO leads (id, email, contact_name, phone, business_name, industry, project_type, selected_product, estimated_total, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, data.email, data.contactName, data.phone, data.businessName, data.industry, data.projectType, data.selectedProduct, data.estimatedTotal, JSON.stringify(data)).run();
    return Response.json({ id, saved: true }, { status: 201 });
  } catch (error) {
    console.error("lead_insert_failed", error);
    return Response.json({ error: "No pudimos guardar la solicitud. Intenta de nuevo." }, { status: 500 });
  }
}
