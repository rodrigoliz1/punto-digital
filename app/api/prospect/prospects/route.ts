import { listProspects } from "@/lib/prospect/queries";
import { mutation, query } from "@/lib/prospect/api";
import { prospectInputSchema, listFiltersSchema } from "@/lib/prospect/schemas";
import { createProspect } from "@/lib/prospect/service";

export async function GET(request: Request) {
  return query(request, "viewer", (ctx) => listProspects(ctx.db, listFiltersSchema.parse(Object.fromEntries(new URL(request.url).searchParams))));
}

export async function POST(request: Request) {
  return mutation(request, "operator", prospectInputSchema, (ctx, body) => createProspect(ctx, body));
}
