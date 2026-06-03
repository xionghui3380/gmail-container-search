/**
 * Prisma 客户端单例
 *
 * 在开发环境下，Next.js 热重载会导致模块被多次加载，
 * 如果每次都 new PrismaClient() 会创建过多数据库连接。
 *
 * 通过 globalThis 缓存确保整个应用只创建一个 PrismaClient 实例。
 * 这是 Next.js + Prisma 的官方推荐模式。
 *
 * 使用方式：import { prisma } from "@/lib/prisma";
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
