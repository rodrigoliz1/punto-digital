import { z } from "zod";
import { configuredSiteOrigin, readJson, requireJsonRequest } from "@/lib/request-security";

const transferSchema = z.object({
  customerName: z.string().min(2).max(120),
  customerEmail: z.string().email().max(160),
  productName: z.string().min(1).max(200),
  addonNames: z.array(z.string()).max(12),
  mode: z.enum(["deposit", "full"]),
  amount: z.number().positive(),
  clabe: z.string().length(18),
  bankName: z.string().min(1).max(80),
  beneficiary: z.string().min(1).max(120),
  whatsappNumber: z.string().min(8).max(20),
  requestId: z.string().uuid(),
}).strict();

function generateOrderNumber(): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PD-${datePart}-${randomPart}`;
}

export async function POST(request: Request) {
  const rejected = requireJsonRequest(request, 10_000);
  if (rejected) return rejected;

  const parsed = transferSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Datos de transferencia inválidos." }, { status: 400 });

  const { customerName, customerEmail, productName, addonNames, mode, amount, clabe, bankName, beneficiary, whatsappNumber, requestId } = parsed.data;
  const orderNumber = generateOrderNumber();
  const origin = configuredSiteOrigin(request);
  const conceptLabel = mode === "deposit" ? "Anticipo" : "Pago total";
  const formattedAmount = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);

  // Try to send via Brevo if API key is configured
  const brevoKey = process.env.BREVO_API_KEY;
  let emailSent = false;

  if (brevoKey) {
    try {
      const addonsHtml = addonNames.length > 0
        ? `<p style="margin:0 0 8px;color:#475569;">Complementos: ${addonNames.join(", ")}</p>`
        : "";

      const emailHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.06);">
  <!-- Header -->
  <tr><td style="background:#061326;padding:36px 40px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:600;letter-spacing:-.02em;">Punto<span style="color:#1769ff;">.</span> Digital</h1>
    <p style="margin:12px 0 0;color:#8899aa;font-size:13px;">Tu punto de partida digital</p>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 8px;color:#0b1f3a;font-size:20px;font-weight:600;">¡Gracias por tu pedido, ${customerName}!</h2>
    <p style="margin:0 0 28px;color:#475569;font-size:14px;line-height:1.7;">Hemos recibido tu solicitud. Para comenzar con tu proyecto, realiza la transferencia con los siguientes datos:</p>

    <!-- Order info -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:28px;">
      <tr><td style="padding:0 0 16px;"><strong style="color:#0b1f3a;font-size:14px;">Número de pedido</strong><br><span style="color:#1769ff;font-size:18px;font-weight:700;">${orderNumber}</span></td></tr>
      <tr><td style="padding:0 0 16px;"><strong style="color:#0b1f3a;font-size:14px;">Paquete</strong><br><span style="color:#475569;font-size:13px;">${productName}</span></td></tr>
      ${addonsHtml}
      <tr><td style="padding:0;"><strong style="color:#0b1f3a;font-size:14px;">${conceptLabel}</strong><br><span style="color:#0b1f3a;font-size:20px;font-weight:700;">${formattedAmount}</span></td></tr>
    </table>

    <!-- Bank details -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7ff;border:1px solid #dbeafe;border-radius:12px;padding:24px;margin-bottom:28px;">
      <tr><td style="padding:0 0 12px;"><strong style="color:#1769ff;font-size:14px;">Datos para transferencia</strong></td></tr>
      <tr><td style="padding:0 0 8px;"><span style="color:#64748b;font-size:11px;">CLABE</span><br><code style="color:#0b1f3a;font-size:15px;font-weight:600;letter-spacing:.02em;">${clabe}</code></td></tr>
      <tr><td style="padding:0 0 8px;"><span style="color:#64748b;font-size:11px;">Banco</span><br><span style="color:#0b1f3a;font-size:14px;">${bankName}</span></td></tr>
      <tr><td style="padding:0;"><span style="color:#64748b;font-size:11px;">Beneficiario</span><br><span style="color:#0b1f3a;font-size:14px;">${beneficiary}</span></td></tr>
    </table>

    <!-- Instructions -->
    <p style="margin:0 0 12px;color:#0b1f3a;font-size:14px;font-weight:600;">Después de transferir:</p>
    <ol style="margin:0 0 28px;padding:0 0 0 20px;color:#475569;font-size:13px;line-height:2;">
      <li>Envía tu comprobante de pago por WhatsApp al <a href="https://wa.me/${whatsappNumber}?text=Hola%2C%20adjunto%20mi%20comprobante%20de%20pago%20para%20el%20pedido%20${orderNumber}" style="color:#1769ff;font-weight:600;">${whatsappNumber}</a></li>
      <li>Incluye tu número de pedido: <strong>${orderNumber}</strong></li>
      <li>Tu proyecto comenzará una vez que confirmemos el pago</li>
    </ol>

    <a href="https://wa.me/${whatsappNumber}?text=Hola%2C%20adjunto%20mi%20comprobante%20de%20pago%20para%20el%20pedido%20${orderNumber}" style="display:inline-block;padding:14px 28px;background:#25D366;color:#fff;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;">Enviar comprobante por WhatsApp</a>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f8fafc;padding:24px 40px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="margin:0;color:#94a3b8;font-size:11px;">Este correo fue generado automáticamente. Responde al WhatsApp si tienes dudas.</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;">Punto Digital · ${origin}</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

      const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": brevoKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: { name: "Punto Digital", email: "pedidos@ipunto.digital" },
          to: [{ email: customerEmail, name: customerName }],
          subject: `Tu pedido #${orderNumber} — Punto Digital`,
          htmlContent: emailHtml,
        }),
        signal: AbortSignal.timeout(12_000),
      });

      if (brevoResponse.ok) {
        emailSent = true;
      } else {
        console.error("Brevo email failed:", await brevoResponse.text());
      }
    } catch (err) {
      console.error("Brevo API error:", err);
    }
  }

  return Response.json({
    orderNumber,
    emailSent,
    amount: formattedAmount,
    clabe,
    bankName,
    beneficiary,
    whatsappNumber,
    instructions: `Envía tu comprobante de pago por WhatsApp al ${whatsappNumber} con tu número de pedido ${orderNumber}.`,
  });
}
