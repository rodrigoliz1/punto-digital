import { ESTIMATED_COST_MICROS } from "./budget";
import { ProspectError } from "./types";

/**
 * Proveedores de imagen configurables. Deshabilitado por defecto; cada imagen generada se guarda
 * en R2 con clave privada no predecible y se rotula como concepto ilustrativo.
 */
export type GeneratedImage = { bytes: Uint8Array; mimeType: "image/png" | "image/webp" | "image/jpeg"; model: string; costMicros: number };

export interface ImageProvider {
  readonly id: string;
  generate(prompt: string): Promise<GeneratedImage>;
}

export const IMAGE_PROVIDERS = ["none", "openai"] as const;
export type ImageProviderId = (typeof IMAGE_PROVIDERS)[number];

/** Endurece el prompt: sin marcas, texto ni personas identificables. */
export function guardImagePrompt(prompt: string) {
  const cleaned = prompt.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 900);
  if (!cleaned) throw new ProspectError("Prompt vacío.", 422, "invalid_prompt");
  return `${cleaned}. Concepto ilustrativo. Sin logotipos, sin marcas registradas, sin texto legible, sin personas identificables.`;
}

/** Adaptador para la API de imágenes de OpenAI (gpt-image-1). No verificado contra la API en vivo en este entorno. */
export function openAiImageProvider(apiKey: string, model = "gpt-image-1", fetchImpl: typeof fetch = fetch): ImageProvider {
  return {
    id: "openai",
    async generate(prompt) {
      if (!apiKey) throw new ProspectError("Falta OPENAI_API_KEY.", 503, "missing_credentials");
      const response = await fetchImpl("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model, prompt: guardImagePrompt(prompt), size: "1024x1024", n: 1 }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new ProspectError(`El proveedor de imágenes respondió ${response.status}.`, 502, "provider_error");
      const data = (await response.json()) as { data?: Array<{ b64_json?: string }> };
      const encoded = data.data?.[0]?.b64_json;
      if (!encoded) throw new ProspectError("El proveedor no devolvió imagen.", 502, "provider_error");
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      if (!(bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)) throw new ProspectError("Formato de imagen inesperado.", 502, "provider_error");
      return { bytes, mimeType: "image/png", model, costMicros: ESTIMATED_COST_MICROS.openai_image_1024 };
    },
  };
}

export function resolveImageProvider(id: string, env: { OPENAI_API_KEY?: string }, model?: string | null): ImageProvider | null {
  if (id === "openai") return openAiImageProvider(env.OPENAI_API_KEY ?? "", model ?? "gpt-image-1");
  return null;
}
