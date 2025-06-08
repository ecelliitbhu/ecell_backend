// lib/prisma.js
// import { PrismaClient } from "../generated/prisma";
import { PrismaClient } from "@prisma/client";
// import pkg from "@prisma/client";
// const { PrismaClient } = pkg;

let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!globalThis.prisma) {
    globalThis.prisma = new PrismaClient();
  }
  prisma = globalThis.prisma;
}

export default prisma;
