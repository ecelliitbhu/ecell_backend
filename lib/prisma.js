// lib/prisma.js
import { PrismaClient } from "@prisma/client";

let prisma;

if (!globalThis.prisma) {
  globalThis.prisma = new PrismaClient();
}

prisma = globalThis.prisma;

prisma.$connect().catch((e) => console.error("Prisma connect error:", e));

export default prisma;
