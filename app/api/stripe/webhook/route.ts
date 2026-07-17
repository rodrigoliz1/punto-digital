function toHex(buffer: ArrayBuffer) { return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook no configurado." }, { status: 503 });
  const signature = request.headers.get("stripe-signature") ?? "";
  const values = Object.fromEntries(signature.split(",").map((part) => part.split("=", 2)));
  const timestamp = values.t;
  const expected = values.v1;
  const payload = await request.text();
  if (!timestamp || !expected || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return Response.json({ error: "Firma inválida." }, { status: 400 });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  if (digest !== expected) return Response.json({ error: "Firma inválida." }, { status: 400 });

  JSON.parse(payload) as { id: string; type: string };
  return Response.json({ received: true, previewMode: true });
}
