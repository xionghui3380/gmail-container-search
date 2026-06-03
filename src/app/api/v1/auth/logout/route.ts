import { clearAuthCookies } from "@/lib/auth";
import { success } from "@/lib/api-response";

export async function POST() {
  clearAuthCookies();
  return success({ ok: true });
}
