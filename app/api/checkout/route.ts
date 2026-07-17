import { z } from "zod";
import { calculateQuote } from "@/config/products";

const checkoutSchema = z.object({ productSlug: z.enum(["esencial", "profesional", "tienda"]), addonSlugs: z.array(z.string()).max(12), mode: z.enum(["deposit", "full"]), email: z.string().email() });

export async function POST(request: Request) {
  const parsed = checkoutSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Configuración de compra inválida." }, { status: 400 });
  const { productSlug, addonSlugs, mode, email } = parsed.data;
  const quote = calculateQuote(productSlug, addonSlugs);
  if (!quote.product.price || quote.total <= 0) return Response.json({ error: "Este proyecto necesita una propuesta personalizada." }, { status: 400 });
  const amount = mode === "deposit" ? quote.deposit : quote.total;
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return Response.json({ url: `${origin}/comprar/confirmacion?modo=demo` });

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${origin}/comprar/confirmacion?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${origin}/cotizador?checkout=cancelado`);
  params.set("customer_email", email);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "mxn");
  params.set("line_items[0][price_data][unit_amount]", String(amount * 100));
  params.set("line_items[0][price_data][product_data][name]", `${quote.product.name} — ${mode === "deposit" ? "Anticipo" : "Pago total"}`);
  params.set("metadata[product_slug]", productSlug);
  params.set("metadata[payment_mode]", mode);

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { authorization: `Bearer ${stripeKey}`, "content-type": "application/x-www-form-urlencoded" }, body: params });
  const session = await stripeResponse.json() as { url?: string; error?: { message?: string } };
  if (!stripeResponse.ok || !session.url) return Response.json({ error: session.error?.message ?? "Stripe no pudo crear la sesión." }, { status: 502 });
  return Response.json({ url: session.url });
}
