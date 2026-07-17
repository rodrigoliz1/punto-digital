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

export type PreviewInput = {
  businessName: string;
  industry: string;
  primaryService: string;
  businessDescription?: string;
  primaryColor: string;
  secondaryColor?: string;
  visualStyle: string;
  mainGoal: string;
  logoUrl?: string;
  features: string[];
};

export type QuoteDraft = PreviewInput & {
  projectType: string;
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
