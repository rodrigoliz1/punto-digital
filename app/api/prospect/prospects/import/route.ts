import { mutation } from "@/lib/prospect/api";
import { importSchema } from "@/lib/prospect/schemas";
import { importProspects } from "@/lib/prospect/service";

export async function POST(request: Request) {
  return mutation(request, "operator", importSchema, (ctx, body) => importProspects(ctx, body.prospects));
}
