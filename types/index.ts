export type ProductSlug = "esencial" | "profesional" | "tienda" | "medida";

export type Product = {
  slug: ProductSlug;
  name: string;
  eyebrow: string;
  description: string;
  price: number | null;
  depositPercentage: number;
  timeline: string;
  featured?: boolean;
  features: string[];
};

export type Addon = {
  slug: string;
  name: string;
  description: string;
  price: number;
};

export type ProjectType =
  | "landing"
  | "corporate"
  | "ecommerce"
  | "redesign"
  | "campaign"
  | "portal";

export type Industry =
  | "professional-services"
  | "medical"
  | "dental"
  | "restaurant"
  | "construction"
  | "real-estate"
  | "architecture"
  | "beauty"
  | "fitness"
  | "education"
  | "retail"
  | "technology"
  | "other";

export type PreviewDevice = "desktop" | "tablet" | "mobile";
export type PreviewColorMode = "light" | "dark";

export type PreviewPreferences = {
  device: PreviewDevice;
  colorMode: PreviewColorMode;
  styleOffset: number;
  paletteOffset: number;
};

export type PreviewInput = {
  projectType: ProjectType;
  businessName: string;
  industry: Industry;
  primaryService: string;
  businessDescription?: string;
  primaryColor: string;
  secondaryColor?: string;
  visualStyle: string;
  mainGoal: string;
  logoUrl?: string;
  features: string[];
};

export type PreviewSection =
  | "hero"
  | "benefits"
  | "trust"
  | "services"
  | "authority"
  | "products"
  | "properties"
  | "gallery"
  | "testimonials"
  | "form"
  | "dashboard"
  | "integrations"
  | "cta"
  | "footer";

export type PreviewPalette = {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  soft: string;
  text: string;
  muted: string;
  border: string;
  onPrimary: string;
};

export type PreviewTemplate = {
  key: string;
  projectType: ProjectType;
  industry: Industry;
  navigationVariant: "minimal" | "corporate" | "commerce" | "editorial" | "app";
  heroVariant: "split" | "centered" | "editorial" | "layered" | "minimal" | "immersive";
  cardVariant: "solid" | "outline" | "lifted" | "soft" | "glass" | "media";
  formVariant: "inline" | "card" | "split" | "floating";
  testimonialVariant: "quote-grid" | "spotlight" | "carousel" | "avatars" | "case-study";
  productVariant: "catalog-grid" | "editorial-list" | "featured-split" | "compact-rail";
  dashboardVariant: "executive" | "operations" | "crm" | "analytics";
  footerVariant: "compact" | "columns" | "cta" | "dark" | "editorial";
  typographyPair: "modern" | "corporate" | "editorial" | "humanist" | "geometric" | "luxury" | "technical" | "friendly";
  sectionOrder: PreviewSection[];
  visualTheme: string;
  imageStyle: string;
  callToAction: string;
  palette: PreviewPalette;
  typography: { heading: string; body: string };
};

export type QuoteDraft = PreviewInput & {
  pages: number;
  hasLogo: boolean;
  hasPhotos: boolean;
  hasTexts: boolean;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  targetDate: string;
  selectedAddons: string[];
};
