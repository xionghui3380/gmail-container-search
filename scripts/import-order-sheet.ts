import path from "path";
import fs from "fs/promises";
import { PrismaClient } from "@prisma/client";
import { importOrderSheetBuffer } from "../src/lib/container-parse-service";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.users.findFirst({
    where: { role: "admin", is_enabled: true },
    orderBy: { id: "asc" },
  });

  if (!admin) {
    throw new Error("未找到 admin 用户，请先运行 npm run db:seed");
  }

  const filePath = path.join(process.cwd(), "docs/复刻google sheet表.xlsx");
  const buffer = await fs.readFile(filePath);

  console.log("开始导入:", filePath);
  const result = await importOrderSheetBuffer(buffer, admin.id);

  console.log("导入完成:", {
    total: result.total,
    parsed: result.imported,
    skipped: result.skipped,
    created: result.created,
    updated: result.updated,
    errorCount: result.errors.length,
  });

  if (result.errors.length > 0) {
    console.log("前 10 条错误:");
    result.errors.slice(0, 10).forEach((err) => console.log(err));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
