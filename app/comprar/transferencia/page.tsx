import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Copy, MessageCircle } from "lucide-react";
import { SITE } from "@/config/site";

export const metadata: Metadata = { title: "Pedido registrado — Transferencia", robots: { index: false, follow: false } };

export default async function TransferSuccessPage({ searchParams }: { searchParams: Promise<{ order?: string; amount?: string; mode?: string; product?: string }> }) {
  const { order, amount, mode, product } = await searchParams;
  const orderNumber = order ?? "PD-XXXXXXXX";
  const conceptLabel = mode === "deposit" ? "Anticipo" : "Pago total";
  const clabe = "638180000152499550";
  const bankName = "NU México";
  const beneficiary = "Punto Digital";

  const whatsappLink = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(`Hola, adjunto mi comprobante de pago para el pedido ${orderNumber}.\n\nPaquete: ${product ?? "No especificado"}\nConcepto: ${conceptLabel}\nMonto: ${amount ?? "Consultar cotización"}`)}`;

  return (
    <main className="state-page state-page--success">
      <CheckCircle2 size={52} />
      <span>Pedido registrado</span>
      <h1>¡Tu pedido está casi listo!</h1>
      <p>Completa la transferencia y envíanos tu comprobante para comenzar con tu proyecto.</p>

      <div className="transfer-summary">
        <div className="transfer-order">
          <strong>Número de pedido</strong>
          <div className="transfer-order-value">
            <code>{orderNumber}</code>
            <button type="button" className="copy-button" onClick={() => navigator.clipboard.writeText(orderNumber)} aria-label="Copiar número de pedido">
              <Copy size={14} />
            </button>
          </div>
        </div>

        {product && (
          <div className="transfer-row">
            <span>Paquete</span>
            <strong>{product}</strong>
          </div>
        )}
        <div className="transfer-row">
          <span>Concepto</span>
          <strong>{conceptLabel}</strong>
        </div>
        {amount && (
          <div className="transfer-row">
            <span>Monto</span>
            <strong>{amount}</strong>
          </div>
        )}
      </div>

      <div className="transfer-bank">
        <div className="transfer-bank-header">
          <Building2 size={22} />
          <div>
            <strong>Datos para transferencia</strong>
            <span>{bankName}</span>
          </div>
        </div>
        <div className="transfer-bank-details">
          <div className="transfer-bank-row">
            <span>CLABE</span>
            <code>{clabe}</code>
          </div>
          <div className="transfer-bank-row">
            <span>Beneficiario</span>
            <strong>{beneficiary}</strong>
          </div>
        </div>
      </div>

      <div className="transfer-instructions-card">
        <h3>Pasos para completar tu pedido</h3>
        <ol>
          <li>Realiza la transferencia con los datos anteriores</li>
          <li>Envía tu comprobante de pago por WhatsApp</li>
          <li>Incluye tu número de pedido: <strong>{orderNumber}</strong></li>
          <li>Revisa tu correo: te enviamos las instrucciones completas</li>
        </ol>
      </div>

      <div className="transfer-actions">
        <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="button" style={{ background: "#25D366", borderColor: "#25D366" }}>
          <MessageCircle size={18} /> Enviar comprobante por WhatsApp
        </a>
        <Link href="/cotizador" className="button button--outline">
          Volver al cotizador <ArrowRight size={17} />
        </Link>
      </div>
    </main>
  );
}
