import type { Signals } from "./types";

/**
 * Agente calificador: puntuación 0–100 determinista y explicable.
 * La evidencia faltante suma 0 y se lista en `missing`: `unknown` no equivale a bajo rendimiento,
 * pero tampoco se inventa. Pesos heredados del MVP de referencia y adaptados a la oferta web.
 */
export const SCORE_WEIGHTS = { budget_fit: 25, presence_gap: 25, activity: 20, product_quality: 15, contact_quality: 10, service_fit: 5 } as const;

export const SIGNAL_LABELS: Record<keyof Signals, string> = {
  budget_fit: "Capacidad de inversión estimada (0–5)",
  presence_gap: "Brecha de presencia digital / visual (0–5)",
  posts_last_28d: "Publicaciones en los últimos 28 días",
  product_quality: "Calidad del producto o servicio (0–5)",
  contact_quality: "Calidad del canal de contacto (0–5)",
  service_fit: "Encaje con servicios de Punto Digital (0–5)",
};

export const DEFAULT_QUALIFY_THRESHOLD = 70;

export type ScoreLine = { key: string; label: string; points: number; max: number; reason: string };
export type ScoreResult = { score: number; lines: ScoreLine[]; missing: string[]; eligible: boolean; threshold: number };

function scaled(value: number | null | undefined, max: number) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.round((max * Math.max(0, Math.min(5, value))) / 5);
}

export function activityPoints(posts: number | null | undefined) {
  if (posts === null || posts === undefined || !Number.isFinite(posts)) return null;
  // Baja frecuencia = mayor oportunidad de mejora; frecuencia muy alta sugiere equipo propio.
  if (posts <= 8) return 20;
  if (posts <= 16) return 12;
  return 3;
}

export function calculateScore(signals: Signals, options: { threshold?: number; hasContactChannel?: boolean } = {}): ScoreResult {
  const threshold = options.threshold ?? DEFAULT_QUALIFY_THRESHOLD;
  const lines: ScoreLine[] = [];
  const missing: string[] = [];
  const add = (key: keyof Signals, max: number, points: number | null, reason: string) => {
    if (points === null) missing.push(key);
    lines.push({ key, label: SIGNAL_LABELS[key], points: points ?? 0, max, reason: points === null ? "Sin evidencia registrada" : reason });
  };
  add("budget_fit", SCORE_WEIGHTS.budget_fit, scaled(signals.budget_fit, SCORE_WEIGHTS.budget_fit), `Valor ${signals.budget_fit}/5`);
  add("presence_gap", SCORE_WEIGHTS.presence_gap, scaled(signals.presence_gap, SCORE_WEIGHTS.presence_gap), `Valor ${signals.presence_gap}/5`);
  add("posts_last_28d", SCORE_WEIGHTS.activity, activityPoints(signals.posts_last_28d), `${signals.posts_last_28d} publicaciones observadas`);
  add("product_quality", SCORE_WEIGHTS.product_quality, scaled(signals.product_quality, SCORE_WEIGHTS.product_quality), `Valor ${signals.product_quality}/5`);
  add("contact_quality", SCORE_WEIGHTS.contact_quality, scaled(signals.contact_quality, SCORE_WEIGHTS.contact_quality), `Valor ${signals.contact_quality}/5`);
  add("service_fit", SCORE_WEIGHTS.service_fit, scaled(signals.service_fit, SCORE_WEIGHTS.service_fit), `Valor ${signals.service_fit}/5`);
  const score = lines.reduce((sum, line) => sum + line.points, 0);
  const eligible = score >= threshold && options.hasContactChannel !== false;
  return { score, lines, missing, eligible, threshold };
}
