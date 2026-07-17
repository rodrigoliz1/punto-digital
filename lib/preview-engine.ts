import type { PreviewInput } from "@/types";

const palettes: Record<string, { surface: string; secondary: string }> = {
  Corporativo: { surface: "#eef4ff", secondary: "#0b1f3a" },
  Minimalista: { surface: "#f8fafc", secondary: "#111827" },
  Elegante: { surface: "#f5f0e8", secondary: "#292524" },
  Tecnológico: { surface: "#071426", secondary: "#38bdf8" },
  Cálido: { surface: "#fff7ed", secondary: "#7c2d12" },
  Creativo: { surface: "#faf5ff", secondary: "#581c87" },
};

export function buildPreview(input: PreviewInput) {
  const fallback = palettes[input.visualStyle] ?? palettes.Corporativo;
  return {
    palette: {
      primary: input.primaryColor || "#1769ff",
      secondary: input.secondaryColor || fallback.secondary,
      surface: fallback.surface,
      text: input.visualStyle === "Tecnológico" ? "#f8fafc" : "#0f172a",
    },
    typography: {
      heading: input.visualStyle === "Elegante" ? "Georgia, serif" : "var(--font-manrope)",
      body: "var(--font-inter)",
    },
    heroVariant: ["split", "centered", "editorial", "layered", "minimal", "immersive"][hash(input.industry) % 6],
    cardVariant: ["solid", "outline", "lifted", "soft", "glass"][hash(input.visualStyle) % 5],
    layoutVariant: ["grid", "rail", "masonry", "stack"][hash(input.industry + input.visualStyle) % 4],
    devicePresentation: "responsive-stage",
  };
}

function hash(value: string) {
  return [...value].reduce((total, char) => total + char.charCodeAt(0), 0);
}
