import { getCurrentUser } from "@/lib/auth";
import { error, success } from "@/lib/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return error("Unauthorized", 401);
  }
  return success({ user });
}
