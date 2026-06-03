import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin123456", 12);
  const admin = await prisma.users.upsert({
    where: { email: "admin@gng.local" },
    update: {},
    create: {
      username: "admin",
      email: "admin@gng.local",
      password_hash: passwordHash,
      full_name: "系统管理员",
      role: "admin",
      is_enabled: true,
    },
  });

  console.log("Seed admin user:", {
    id: admin.id.toString(),
    email: admin.email,
    password: "Admin123456",
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
