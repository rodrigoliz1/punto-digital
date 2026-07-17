import {
  CARD_VARIANTS,
  DASHBOARD_VARIANTS,
  FOOTER_VARIANTS,
  FORM_VARIANTS,
  HERO_VARIANTS,
  INDUSTRY_MAP,
  LEGACY_INDUSTRY_MAP,
  LEGACY_PROJECT_TYPE_MAP,
  NAVIGATION_VARIANTS,
  PRODUCT_VARIANTS,
  PROJECT_TYPES,
  TESTIMONIAL_VARIANTS,
  TYPOGRAPHY_MAP,
  TYPOGRAPHY_PAIRS,
} from "@/config/preview";
import type { Industry, PreviewColorMode, PreviewInput, PreviewTemplate, ProjectType, QuoteDraft } from "@/types";

type BuildOptions = { paletteOffset?: number; styleOffset?: number; colorMode?: PreviewColorMode };

function hash(value: string) {
  let result = 2166136261;
  for (const char of value) {
    result ^= char.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function pick<T>(items: readonly T[], seed: string, offset = 0): T {
  return items[(hash(seed) + offset + items.length * 100) % items.length];
}

export function normalizeProjectType(value: unknown): ProjectType {
  return LEGACY_PROJECT_TYPE_MAP[String(value)] ?? "corporate";
}

export function normalizeIndustry(value: unknown): Industry {
  const raw = String(value);
  if (raw in INDUSTRY_MAP) return raw as Industry;
  return LEGACY_INDUSTRY_MAP[raw] ?? "other";
}

export function migrateQuoteDraft<T extends Partial<QuoteDraft>>(draft: T): T & { projectType: ProjectType; industry: Industry } {
  return { ...draft, projectType: normalizeProjectType(draft.projectType), industry: normalizeIndustry(draft.industry) };
}

export function slugifyBusinessName(name: string) {
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "tu-negocio"}.mx`;
}

function validHex(value?: string) {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? value!.toUpperCase() : null;
}

function rgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function hex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function mix(one: string, two: string, amount: number) {
  const a = rgb(one);
  const b = rgb(two);
  return hex({ r: a.r + (b.r - a.r) * amount, g: a.g + (b.g - a.g) * amount, b: a.b + (b.b - a.b) * amount });
}

function luminance(color: string) {
  const channels = Object.values(rgb(color)).map((channel) => {
    const normalized = channel / 255;
    return normalized <= .03928 ? normalized / 12.92 : ((normalized + .055) / 1.055) ** 2.4;
  });
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

export function foregroundFor(background: string) {
  const value = validHex(background) ?? "#1769FF";
  const whiteContrast = 1.05 / (luminance(value) + .05);
  const darkContrast = (luminance(value) + .05) / .05;
  return whiteContrast >= darkContrast ? "#FFFFFF" : "#081426";
}

function navigationFor(projectType: ProjectType, industry: Industry, seed: string) {
  if (projectType === "portal") return "app" as const;
  if (projectType === "ecommerce") return "commerce" as const;
  if (projectType === "landing" || projectType === "campaign") return "minimal" as const;
  if (industry === "architecture" || industry === "beauty") return "editorial" as const;
  return pick(NAVIGATION_VARIANTS.filter((variant) => variant === "corporate" || variant === "editorial"), seed);
}

export function buildPreview(input: PreviewInput, options: BuildOptions = {}): PreviewTemplate {
  const projectType = normalizeProjectType(input.projectType);
  const industry = normalizeIndustry(input.industry);
  const definition = INDUSTRY_MAP[industry];
  const project = PROJECT_TYPES.find((item) => item.slug === projectType) ?? PROJECT_TYPES[1];
  const paletteOffset = options.paletteOffset ?? 0;
  const styleOffset = options.styleOffset ?? 0;
  const colorMode = options.colorMode ?? "light";
  const seed = [projectType, industry, input.visualStyle, input.mainGoal].join("|");
  const requestedPrimary = validHex(input.primaryColor);
  const basePrimary = paletteOffset % 3 === 1 ? definition.palette.accent : requestedPrimary ?? definition.palette.primary;
  const primary = paletteOffset % 3 === 2 ? mix(definition.palette.primary, definition.palette.accent, .38) : basePrimary;
  const accent = paletteOffset % 3 === 1 ? definition.palette.primary : definition.palette.accent;
  const inherentlyDark = luminance(definition.palette.background) < .15;
  const dark = colorMode === "dark" || inherentlyDark;
  const background = dark ? mix(definition.palette.background, "#050B13", inherentlyDark ? .08 : .9) : definition.palette.background;
  const surface = dark ? mix(definition.palette.surface, "#081322", inherentlyDark ? .08 : .88) : definition.palette.surface;
  const soft = dark ? mix(definition.palette.soft, "#0C1929", inherentlyDark ? .1 : .8) : definition.palette.soft;
  const typographyPair = pick(TYPOGRAPHY_PAIRS, `${seed}:type`, styleOffset);

  return {
    key: `${seed}|${paletteOffset}|${styleOffset}|${colorMode}`,
    projectType,
    industry,
    navigationVariant: navigationFor(projectType, industry, `${seed}:nav`),
    heroVariant: pick(HERO_VARIANTS, `${seed}:hero`, styleOffset),
    cardVariant: pick(CARD_VARIANTS, `${seed}:cards`, styleOffset),
    formVariant: pick(FORM_VARIANTS, `${seed}:form`, styleOffset),
    testimonialVariant: pick(TESTIMONIAL_VARIANTS, `${seed}:testimonial`, styleOffset),
    productVariant: pick(PRODUCT_VARIANTS, `${seed}:product`, styleOffset),
    dashboardVariant: pick(DASHBOARD_VARIANTS, `${seed}:dashboard`, styleOffset),
    footerVariant: pick(FOOTER_VARIANTS, `${seed}:footer`, styleOffset),
    typographyPair,
    sectionOrder: [...project.sections],
    visualTheme: definition.visualTheme,
    imageStyle: definition.imageStyle,
    callToAction: definition.primaryCta,
    palette: {
      primary,
      accent,
      background,
      surface,
      soft,
      text: dark ? "#F5F8FC" : definition.palette.text,
      muted: dark ? mix(definition.palette.muted, "#FFFFFF", .42) : definition.palette.muted,
      border: dark ? mix(definition.palette.border, "#FFFFFF", .08) : definition.palette.border,
      onPrimary: foregroundFor(primary),
    },
    typography: TYPOGRAPHY_MAP[typographyPair],
  };
}
