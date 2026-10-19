import { ProspectError } from "./types";

export const PROVIDERS = ["google_places", "anthropic", "openai_images"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const PROVIDER_LABELS: Record<Provider, string> = { google_places: "Google Places API", anthropic: "Claude (Anthropic)", openai_images: "Imágenes (OpenAI)" };

/**
 * Costos estimados en micro-USD. Son referencias para el control de gasto, no facturación:
 * verificar contra la consola de cada proveedor antes de fijar límites.
 */
export const ESTIMATED_COST_MICROS = {
  google_places_text_search: 35_000, // Text Search con campos de contacto (SKU Enterprise)
  openai_image_1024: 42_000,
  anthropic_brief_ceiling: 400_000, // tope reservado antes de llamar; el costo real se registra con el uso devuelto
} as const;

/** Precio por token de Claude Opus 5.5 ($4 / $20 por millón) expresado en micro-USD. */
export const ANTHROPIC_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

export function anthropicCostMicros(model: string, usage: { input_tokens: number; output_tokens: number }) {
  const price = ANTHROPIC_PRICING[model] ?? ANTHROPIC_PRICING["claude-opus-5-5"];
  return Math.ceil(usage.input_tokens * price.input + usage.output_tokens * price.output);
}

export type BudgetRow = { provider: string; monthly_limit_usd_cents: number; enabled: number | boolean };

/** Deniega por defecto: sin presupuesto habilitado no hay llamadas externas con costo. */
export function assertWithinBudget(provider: Provider, budget: BudgetRow | null, monthSpendMicros: number, estimateMicros: number) {
  if (!budget || !budget.enabled) throw new ProspectError(`${PROVIDER_LABELS[provider]} está deshabilitado. Configura un presupuesto mensual para activarlo.`, 402, "budget_disabled");
  const limitMicros = budget.monthly_limit_usd_cents * 10_000;
  if (monthSpendMicros + estimateMicros > limitMicros) throw new ProspectError(`Se alcanzaría el límite mensual de ${PROVIDER_LABELS[provider]} (US$${(budget.monthly_limit_usd_cents / 100).toFixed(2)}).`, 402, "budget_exceeded");
}

export function monthStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function formatUsdMicros(micros: number) {
  return `US$${(micros / 1_000_000).toFixed(2)}`;
}
