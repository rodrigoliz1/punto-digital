import type { Channel } from "./types";

/**
 * Agente de redacción comercial: borradores deterministas, nunca enviados por el sistema.
 * Cada personalización se respalda con evidencia registrada; sin evidencia, no se menciona.
 */
export const DEMO_LINK_PLACEHOLDER = "{{enlace_propuesta}}";
export const OPT_OUT_LINE = "Si prefieren no recibir más mensajes, respondan «no» y no volveremos a contactarles.";

export type OutreachEvidence = { claim: string; source: string };

export type OutreachInput = {
  channel: Channel;
  step: number;
  prospect: { name: string; category: string; city: string; zone: string | null; website: string | null; instagram_url: string | null };
  senderName: string;
};

export type OutreachDraft = { subject: string | null; body: string; evidence: OutreachEvidence[] };

export function draftOutreach({ channel, step, prospect, senderName }: OutreachInput): OutreachDraft {
  const evidence: OutreachEvidence[] = [];
  const observations: string[] = [];
  if (prospect.website) {
    observations.push("revisamos su sitio web");
    evidence.push({ claim: "Se revisó el sitio web del negocio", source: prospect.website });
  }
  if (prospect.instagram_url) {
    observations.push("vimos su perfil público de Instagram");
    evidence.push({ claim: "Se revisó el perfil público de Instagram", source: prospect.instagram_url });
  }
  const observed = observations.length ? `Hace poco ${observations.join(" y ")} y preparamos` : "Preparamos";
  const greeting = `Hola, equipo de ${prospect.name}:`;
  const signature = `${senderName}\nPunto Digital · Guadalajara`;
  if (step > 1) {
    const body = [greeting, "", `Les escribo de nuevo por la propuesta conceptual que preparamos para ${prospect.name}. Sigue disponible aquí: ${DEMO_LINK_PLACEHOLDER}`, "", "Si no es buen momento, no hay problema.", OPT_OUT_LINE, "", signature].join("\n");
    return { subject: channel === "email" ? `Seguimiento: propuesta visual para ${prospect.name}` : null, body, evidence };
  }
  const body = [
    greeting,
    "",
    `${observed} una propuesta visual conceptual para ${prospect.name}: una dirección de contenido y nueve piezas de ejemplo pensadas para un negocio de ${prospect.category} en ${prospect.zone ?? prospect.city}.`,
    "",
    `Pueden verla aquí (enlace privado y temporal): ${DEMO_LINK_PLACEHOLDER}`,
    "",
    "Son conceptos ilustrativos, no fotografías de su negocio. Si les resulta útil, ¿les parece una llamada de 15 minutos esta semana para conocer qué necesitan?",
    "",
    OPT_OUT_LINE,
    "",
    signature,
  ].join("\n");
  return { subject: channel === "email" ? `Una propuesta visual para ${prospect.name}` : null, body, evidence };
}

export function renderWithLink(body: string, link: string) {
  return body.split(DEMO_LINK_PLACEHOLDER).join(link);
}
