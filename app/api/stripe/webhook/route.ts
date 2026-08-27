import { calculateQuote } from "@/config/products";
import { getD1Binding } from "@/lib/runtime-bindings";

function toHex(buffer: ArrayBuffer) { return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function parseSignature(value: string) {
  const values = new Map<string, string[]>();
  for (const part of value.split(",")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const entry = part.slice(separator + 1).trim();
    values.set(key, [...(values.get(key) ?? []), entry]);
  }
  return { timestamp: values.get("t")?.[0], signatures: values.get("v1") ?? [] };
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook no configurado." }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > 1_000_000) return Response.json({ error: "Evento demasiado grande." }, { status: 413 });
  const signature = request.headers.get("stripe-signature") ?? "";
  const { timestamp, signatures } = parseSignature(signature);
  const payload = await request.text();
  const timestampNumber = Number(timestamp);
  if (!timestamp || signatures.length === 0 || !Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 300) return Response.json({ error: "Firma inválida." }, { status: 400 });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  if (!signatures.some((candidate) => safeEqual(digest, candidate))) return Response.json({ error: "Firma inválida." }, { status: 400 });

  let event: { id?: unknown; type?: unknown; data?: { object?: unknown } };
  try { event = JSON.parse(payload) as { id?: unknown; type?: unknown; data?: { object?: unknown } }; } catch { return Response.json({ error: "Evento inválido." }, { status: 400 }); }
  if (typeof event.id !== "string" || typeof event.type !== "string") return Response.json({ error: "Evento inválido." }, { status: 400 });
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"].includes(event.type)) return Response.json({ received: true, ignored: true });
  const db = getD1Binding();
  if (!db) return Response.json({ error: "Persistencia de pagos no disponible. El evento no fue confirmado para permitir reintento." }, { status: 503 });

  const existingEvent = await db.prepare("SELECT status FROM webhook_events WHERE provider = 'stripe' AND provider_event_id = ?").bind(event.id).first<{ status: string }>();
  if (existingEvent?.status === "processed" || existingEvent?.status === "rejected") return Response.json({ received: true, duplicate: true });
  const inserted = await db.prepare("INSERT OR IGNORE INTO webhook_events (id, provider, provider_event_id, type, payload_hash, status) VALUES (?, 'stripe', ?, ?, ?, 'received')")
    .bind(crypto.randomUUID(), event.id, event.type, digest)
    .run();
  if ((inserted.meta?.changes ?? 0) === 0 && !existingEvent) return Response.json({ error: "No fue posible registrar el evento." }, { status: 503 });

  const session = event.data?.object as {
    id?: unknown;
    amount_total?: unknown;
    currency?: unknown;
    payment_status?: unknown;
    payment_intent?: unknown;
    customer_email?: unknown;
    customer_details?: { email?: unknown };
    metadata?: Record<string, unknown>;
  } | undefined;
  const metadata = session?.metadata;
  const productSlug = metadata?.product_slug;
  const addonSlugs = typeof metadata?.addon_slugs === "string" && metadata.addon_slugs ? metadata.addon_slugs.split(",") : [];
  const paymentMode = metadata?.payment_mode;
  const orderId = metadata?.order_id;
  if (!session || typeof session.id !== "string" || typeof orderId !== "string" || typeof productSlug !== "string" || !["deposit", "full"].includes(String(paymentMode))) {
    await db.prepare("UPDATE webhook_events SET status = 'invalid', processed_at = CURRENT_TIMESTAMP WHERE provider = 'stripe' AND provider_event_id = ?").bind(event.id).run();
    return Response.json({ error: "Sesión de pago incompleta." }, { status: 400 });
  }

  const quote = calculateQuote(productSlug, addonSlugs);
  if (!quote.product.price) return Response.json({ error: "Producto no procesable." }, { status: 400 });
  const expectedAmount = paymentMode === "deposit" ? quote.deposit : quote.total;
  const amountMatches = session.currency === "mxn" && session.amount_total === expectedAmount * 100;
  if (!amountMatches) {
    await db.prepare("UPDATE orders SET status = 'amount_mismatch', stripe_checkout_session_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(session.id, orderId).run();
    await db.prepare("UPDATE webhook_events SET status = 'rejected', processed_at = CURRENT_TIMESTAMP WHERE provider = 'stripe' AND provider_event_id = ?").bind(event.id).run();
    return Response.json({ received: true, rejected: true });
  }
  if (event.type === "checkout.session.async_payment_failed") {
    await db.prepare("UPDATE orders SET status = 'payment_failed', stripe_checkout_session_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(session.id, orderId).run();
    await db.prepare("UPDATE webhook_events SET status = 'processed', processed_at = CURRENT_TIMESTAMP WHERE provider = 'stripe' AND provider_event_id = ?").bind(event.id).run();
    return Response.json({ received: true });
  }
  if (session.payment_status !== "paid") {
    await db.prepare("UPDATE orders SET status = 'awaiting_payment', stripe_checkout_session_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(session.id, orderId).run();
    await db.prepare("UPDATE webhook_events SET status = 'processed', processed_at = CURRENT_TIMESTAMP WHERE provider = 'stripe' AND provider_event_id = ?").bind(event.id).run();
    return Response.json({ received: true });
  }

  const order = await db.prepare("SELECT id, customer_email, total, deposit_amount, stripe_checkout_session_id FROM orders WHERE id = ?").bind(orderId).first<{ id: string; customer_email: string; total: number; deposit_amount: number | null; stripe_checkout_session_id: string | null }>();
  if (!order) return Response.json({ error: "Pedido no encontrado. El evento no fue confirmado para permitir reintento." }, { status: 503 });
  const persistedAmount = paymentMode === "deposit" ? order.deposit_amount : order.total;
  if (persistedAmount !== expectedAmount || (order.stripe_checkout_session_id && order.stripe_checkout_session_id !== session.id)) {
    await db.prepare("UPDATE orders SET status = 'session_mismatch', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(orderId).run();
    await db.prepare("UPDATE webhook_events SET status = 'rejected', processed_at = CURRENT_TIMESTAMP WHERE provider = 'stripe' AND provider_event_id = ?").bind(event.id).run();
    return Response.json({ received: true, rejected: true });
  }
  const customerEmail = typeof session.customer_details?.email === "string" ? session.customer_details.email : typeof session.customer_email === "string" ? session.customer_email : order.customer_email;
  const paymentId = typeof session.payment_intent === "string" ? session.payment_intent : session.id;
  const orderStatus = paymentMode === "deposit" ? "deposit_paid" : "paid";
  await db.prepare("UPDATE orders SET customer_email = ?, status = ?, stripe_checkout_session_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(customerEmail.toLowerCase(), orderStatus, session.id, orderId).run();
  await db.prepare("INSERT OR IGNORE INTO payments (id, order_id, provider, provider_payment_id, amount, currency, status, paid_at) VALUES (?, ?, 'stripe', ?, ?, 'mxn', 'paid', CURRENT_TIMESTAMP)").bind(`payment_${paymentId}`, orderId, paymentId, expectedAmount).run();
  await db.prepare("INSERT OR IGNORE INTO projects (id, order_id, name, status, progress) VALUES (?, ?, ?, 'request_received', 0)").bind(`project_${orderId}`, orderId, quote.product.name).run();
  await db.prepare("UPDATE webhook_events SET status = 'processed', processed_at = CURRENT_TIMESTAMP WHERE provider = 'stripe' AND provider_event_id = ?").bind(event.id).run();

  return Response.json({ received: true });
}
