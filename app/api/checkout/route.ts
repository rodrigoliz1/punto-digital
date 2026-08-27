import { z } from "zod";
import { calculateQuote } from "@/config/products";
import { configuredSiteOrigin, readJson, requireJsonRequest } from "@/lib/request-security";
import { getD1Binding } from "@/lib/runtime-bindings";

const checkoutSchema = z.object({ productSlug: z.enum(["esencial", "profesional", "tienda"]), addonSlugs: z.array(z.string()).max(12), mode: z.enum(["deposit", "full"]), email: z.string().email().max(160), requestId: z.string().uuid() }).strict();

export async function POST(request: Request) {
  const rejected = requireJsonRequest(request, 10_000);
  if (rejected) return rejected;
  const parsed = checkoutSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Configuración de compra inválida." }, { status: 400 });
  const { productSlug, addonSlugs, mode, email, requestId } = parsed.data;
  const quote = calculateQuote(productSlug, addonSlugs);
  if (!quote.product.price || quote.total <= 0) return Response.json({ error: "Este proyecto necesita una propuesta personalizada." }, { status: 400 });
  const amount = mode === "deposit" ? quote.deposit : quote.total;
  const origin = configuredSiteOrigin(request);
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return Response.json({ url: `${origin}/comprar/confirmacion?modo=demo`, previewMode: true });
  const db = getD1Binding();
  if (!db) return Response.json({ error: "Los pagos están deshabilitados porque la persistencia del pedido no está disponible." }, { status: 503 });
  const orderId = `order_${requestId}`;

  await db.prepare("INSERT OR IGNORE INTO orders (id, customer_email, status, total, deposit_amount) VALUES (?, ?, 'pending', ?, ?)")
    .bind(orderId, email.toLowerCase(), quote.total, quote.deposit)
    .run();
  const existingOrder = await db.prepare("SELECT customer_email, total, deposit_amount FROM orders WHERE id = ?").bind(orderId).first<{ customer_email: string; total: number; deposit_amount: number | null }>();
  if (!existingOrder || existingOrder.customer_email !== email.toLowerCase() || existingOrder.total !== quote.total || existingOrder.deposit_amount !== quote.deposit) {
    return Response.json({ error: "La solicitud de pago ya fue utilizada con otra configuración." }, { status: 409 });
  }
  await db.prepare("INSERT OR IGNORE INTO order_items (id, order_id, item_slug, name, amount) VALUES (?, ?, ?, ?, ?)")
    .bind(`${orderId}_product`, orderId, quote.product.slug, quote.product.name, quote.base)
    .run();
  for (const addon of quote.addons) {
    await db.prepare("INSERT OR IGNORE INTO order_items (id, order_id, item_slug, name, amount) VALUES (?, ?, ?, ?, ?)")
      .bind(`${orderId}_addon_${addon.slug}`, orderId, addon.slug, addon.name, addon.price)
      .run();
  }

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
  params.set("metadata[addon_slugs]", quote.addons.map((addon) => addon.slug).join(","));
  params.set("metadata[expected_amount_mxn]", String(amount));
  params.set("metadata[request_id]", requestId);
  params.set("metadata[order_id]", orderId);

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { authorization: `Bearer ${stripeKey}`, "content-type": "application/x-www-form-urlencoded", "idempotency-key": requestId }, body: params, signal: AbortSignal.timeout(12_000) });
  const session = await stripeResponse.json() as { id?: string; url?: string; error?: { message?: string } };
  if (!stripeResponse.ok || !session.url) {
    await db.prepare("UPDATE orders SET status = 'checkout_failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(orderId).run();
    return Response.json({ error: session.error?.message ?? "Stripe no pudo crear la sesión." }, { status: 502 });
  }
  if (session.id) await db.prepare("UPDATE orders SET stripe_checkout_session_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(session.id, orderId).run();
  return Response.json({ url: session.url });
}
