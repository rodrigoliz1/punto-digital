import { listProspects } from "@/lib/prospect/queries";
import { mutation, query } from "@/lib/prospect/api";
import { prospectInputSchema, listFiltersSchema } from "@/lib/prospect/schemas";
import { createProspect } from "@/lib/prospect/service";

export async function GET(request: Request) {
  const filters = listFiltersSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return query("viewer", (ctx) => listProspects(ctx.db, filters));
}

export async function POST(request: Request) {
  return mutation(request, "operator", prospectInputSchema, (ctx, body) => createProspect(ctx, body));
}
