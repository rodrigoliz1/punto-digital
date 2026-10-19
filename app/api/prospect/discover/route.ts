import { idempotencyKey, mutation } from "@/lib/prospect/api";
import { discoverSchema } from "@/lib/prospect/schemas";
import { discover } from "@/lib/prospect/service";

export async function POST(request: Request) {
  return mutation(request, "operator", discoverSchema, (ctx, body) => discover(ctx, body, idempotencyKey(request)));
}
