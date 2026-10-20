import { z } from "zod";
import { emptyBody, mutation } from "@/lib/prospect/api";
import { agentConfigSchema, budgetSchema, campaignSchema, teamSchema } from "@/lib/prospect/schemas";
import * as service from "@/lib/prospect/service";

type Params = { params: Promise<{ section: string }> };

const campaignWithId = campaignSchema.extend({ id: z.string().regex(/^cmp_[0-9a-f]{32}$/).optional() });

export async function POST(request: Request, { params }: Params) {
  const { section } = await params;
  switch (section) {
    case "agents": return mutation(request, "admin", agentConfigSchema, (ctx, body) => service.saveAgentConfig(ctx, body));
    case "budgets": return mutation(request, "admin", budgetSchema, (ctx, body) => service.saveBudget(ctx, body));
    case "team": return mutation(request, "admin", teamSchema, (ctx, body) => service.saveTeamMember(ctx, body));
    case "campaigns": return mutation(request, "reviewer", campaignWithId, (ctx, { id, ...body }) => service.saveCampaign(ctx, body, id));
    case "purge-places": return mutation(request, "admin", emptyBody, (ctx) => service.purgeExpiredPlacesContent(ctx));
    default: return Response.json({ error: "No encontrado." }, { status: 404 });
  }
}
