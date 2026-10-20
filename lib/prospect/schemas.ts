import { z } from "zod";
import { ACTIVITY_TYPES, AGENTS, CHANNELS, PROSPECT_STATUSES, ROLES, SUPPRESSION_KINDS } from "./types";
import { PROVIDERS } from "./budget";
import { IMAGE_PROVIDERS } from "./images";

const httpUrl = z.string().trim().max(500).url().refine((value) => /^https?:\/\//i.test(value), "Solo URLs http(s)");
const optionalUrl = z.union([httpUrl, z.literal(""), z.null()]).optional().transform((value) => value || null);
const signal = z.number().int().min(0).max(5).nullable().optional();

export const signalsSchema = z.object({
  budget_fit: signal,
  presence_gap: signal,
  posts_last_28d: z.number().int().min(0).max(500).nullable().optional(),
  product_quality: signal,
  contact_quality: signal,
  service_fit: signal,
}).strict();

export const prospectInputSchema = z.object({
  name: z.string().trim().min(2).max(200),
  category: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  zone: z.string().trim().max(100).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  sourceUrl: httpUrl,
  website: optionalUrl,
  emailPublic: z.union([z.string().trim().email().max(160), z.literal(""), z.null()]).optional().transform((value) => value || null),
  phonePublic: z.string().trim().max(40).nullable().optional(),
  instagramUrl: optionalUrl,
  facebookUrl: optionalUrl,
  campaignId: z.string().max(80).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  signals: signalsSchema.optional(),
}).strict();
export type ProspectInput = z.input<typeof prospectInputSchema>;

export const prospectPatchSchema = prospectInputSchema.partial().omit({ sourceUrl: true }).strict();

export const importSchema = z.object({ prospects: z.array(prospectInputSchema).min(1).max(100) }).strict();

export const discoverSchema = z.object({
  category: z.string().trim().min(2).max(80),
  city: z.enum(["Guadalajara", "Zapopan"]),
  zone: z.string().trim().max(80).nullable().optional(),
  pageSize: z.number().int().min(1).max(20).optional(),
  campaignId: z.string().max(80).nullable().optional(),
}).strict();

export const briefOptionsSchema = z.object({ useLlm: z.boolean().optional() }).strict();
export const imagesOptionsSchema = z.object({ count: z.number().int().min(1).max(9).optional() }).strict();

export const draftSchema = z.object({
  channel: z.enum(CHANNELS),
  step: z.number().int().min(1).max(3).optional(),
  recipient: z.string().trim().max(200).optional(),
  campaignId: z.string().max(80).nullable().optional(),
}).strict();

export const messagePatchSchema = z.object({ subject: z.string().trim().max(200).nullable().optional(), body: z.string().trim().min(10).max(4000).optional(), recipient: z.string().trim().max(200).optional() }).strict();

export const activitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  summary: z.string().trim().min(2).max(2000),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  dealValueMxn: z.number().min(0).max(10_000_000).nullable().optional(),
}).strict();

export const suppressionSchema = z.object({
  kind: z.enum(SUPPRESSION_KINDS),
  value: z.string().trim().min(2).max(200),
  reason: z.string().trim().min(3).max(300),
  source: z.enum(["opt_out_reply", "manual", "legal_request", "bounce"]).default("manual"),
}).strict();

export const prospectSuppressSchema = z.object({ reason: z.string().trim().min(3).max(300) }).strict();

export const agentConfigSchema = z.object({
  agent: z.enum(AGENTS),
  enabled: z.boolean(),
  provider: z.enum(["deterministic", "anthropic", "google_places"]),
  model: z.string().max(80).nullable().optional(),
  settings: z.object({
    threshold: z.number().int().min(0).max(100).optional(),
    effort: z.enum(["low", "medium", "high"]).optional(),
    imageProvider: z.enum(IMAGE_PROVIDERS).optional(),
    imageModel: z.string().max(80).optional(),
    senderName: z.string().max(80).optional(),
  }).strict().default({}),
}).strict();

export const budgetSchema = z.object({ provider: z.enum(PROVIDERS), monthlyLimitUsd: z.number().min(0).max(5000), enabled: z.boolean() }).strict();

export const teamSchema = z.object({ email: z.string().trim().toLowerCase().email().max(160), role: z.enum(ROLES).exclude(["owner"]), active: z.boolean().default(true) }).strict();

export const campaignSchema = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().max(80).nullable().optional(),
  zone: z.string().trim().max(80).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  status: z.enum(["draft", "active", "paused", "closed"]).default("draft"),
  dailyContactCap: z.number().int().min(1).max(50).default(10),
  notes: z.string().max(1000).nullable().optional(),
}).strict();

export const listFiltersSchema = z.object({
  status: z.enum(PROSPECT_STATUSES).optional(),
  city: z.string().max(80).optional(),
  category: z.string().max(80).optional(),
  q: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
