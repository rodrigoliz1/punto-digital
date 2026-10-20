export const PROSPECT_STATUSES = ["discovered", "qualified", "demo_ready", "approved", "contacted", "replied", "meeting", "won", "lost", "suppressed"] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export const STATUS_LABELS: Record<ProspectStatus, string> = {
  discovered: "Descubierto",
  qualified: "Calificado",
  demo_ready: "Demo lista",
  approved: "Aprobado",
  contacted: "Contactado",
  replied: "Respondió",
  meeting: "Reunión",
  won: "Cliente",
  lost: "Perdido",
  suppressed: "Excluido",
};

export const ROLES = ["viewer", "operator", "reviewer", "admin", "owner"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = { viewer: "Lectura", operator: "Operador", reviewer: "Revisor", admin: "Administrador", owner: "Propietario" };

export function roleAtLeast(role: Role, minimum: Role) {
  return ROLES.indexOf(role) >= ROLES.indexOf(minimum);
}

/** Quién ejecuta una acción. Los agentes nunca pueden aprobar ni marcar contactos. */
export type Actor = { kind: "human"; email: string; role: Role } | { kind: "agent"; agent: AgentName; onBehalfOf: string };

export function actorId(actor: Actor) {
  return actor.kind === "human" ? actor.email : `agent:${actor.agent}<${actor.onBehalfOf}>`;
}

export const AGENTS = ["researcher", "qualifier", "brand_analyst", "creative", "demo_builder", "outreach_writer", "reviewer"] as const;
export type AgentName = (typeof AGENTS)[number];

export const AGENT_LABELS: Record<AgentName, { name: string; description: string }> = {
  researcher: { name: "Investigador", description: "Descubre negocios con Google Places API y registra fuente y fecha." },
  qualifier: { name: "Calificador", description: "Puntuación determinista y explicable; la evidencia faltante no se inventa." },
  brand_analyst: { name: "Analista de marca", description: "Lee el sitio público del negocio con protección SSRF y sintetiza identidad." },
  creative: { name: "Creativo", description: "Brief y prompts de imagen; imágenes sintéticas rotuladas como concepto ilustrativo." },
  demo_builder: { name: "Constructor de demos", description: "Página privada con etiquetas visibles de simulación y enlace con expiración." },
  outreach_writer: { name: "Redacción comercial", description: "Borradores no enviados con personalización respaldada por evidencia." },
  reviewer: { name: "Supervisor de cumplimiento", description: "Verifica hechos, supresión, derechos y canal antes de pedir aprobación humana." },
};

export const CHANNELS = ["email", "instagram_dm", "whatsapp", "phone", "in_person"] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABELS: Record<Channel, string> = { email: "Correo", instagram_dm: "Instagram (manual)", whatsapp: "WhatsApp (manual)", phone: "Llamada", in_person: "Visita" };

export const SUPPRESSION_KINDS = ["email", "domain", "phone", "instagram", "place_id"] as const;
export type SuppressionKind = (typeof SUPPRESSION_KINDS)[number];

export const ACTIVITY_TYPES = ["note", "reply", "meeting", "follow_up", "won", "lost"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export type Signals = {
  budget_fit?: number | null;
  presence_gap?: number | null;
  posts_last_28d?: number | null;
  product_quality?: number | null;
  contact_quality?: number | null;
  service_fit?: number | null;
};

export type ProspectRow = {
  id: string;
  name: string;
  category: string;
  city: string;
  zone: string | null;
  address: string | null;
  website: string | null;
  website_domain: string | null;
  email_public: string | null;
  phone_public: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  google_place_id: string | null;
  source: string;
  source_url: string;
  source_checked_at: string;
  places_content_expires_at: string | null;
  status: ProspectStatus;
  score: number;
  score_breakdown: string | null;
  missing_evidence: string | null;
  signals: string;
  campaign_id: string | null;
  notes: string | null;
  dedupe_key: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export class ProspectError extends Error {
  constructor(message: string, readonly status: number = 409, readonly code = "conflict") {
    super(message);
  }
}
