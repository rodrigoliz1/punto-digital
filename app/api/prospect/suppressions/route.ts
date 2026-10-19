import { mutation } from "@/lib/prospect/api";
import { suppressionSchema } from "@/lib/prospect/schemas";
import { addSuppression } from "@/lib/prospect/service";

export async function POST(request: Request) {
  return mutation(request, "operator", suppressionSchema, (ctx, body) => addSuppression(ctx, body));
}
