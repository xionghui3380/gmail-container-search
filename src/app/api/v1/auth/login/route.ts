import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  type AuthUser,
} from "@/lib/auth";
import { error, success } from "@/lib/api-response";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return error("Validation failed", 400, parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })));
    }

    const { email, password, remember } = parsed.data;
    const user = await prisma.users.findFirst({
      where: { email, is_enabled: true },
    });

    if (!user) {
      return error("邮箱或密码错误", 401);
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return error("邮箱或密码错误", 401);
    }

    const authUser: AuthUser = {
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    };

    const accessToken = await signAccessToken(authUser);
    const refreshToken = await signRefreshToken(authUser);
    setAuthCookies(accessToken, refreshToken, remember);

    return success({
      user: authUser,
    });
  } catch (err) {
    console.error("[auth/login]", err);
    return error("登录失败", 500);
  }
}
