// lib/prisma.js
import { PrismaClient } from "@prisma/client";

// Supabase exposes two poolers:
//
//   :6543  transaction mode — Prisma must be told `pgbouncer=true`, which disables
//          prepared statements and makes the engine wrap EVERY query in
//          `BEGIN; DEALLOCATE ALL; <query>; COMMIT`. That is 4 network round trips
//          per query. Against ap-southeast-1 (~100ms RTT) a trivial `SELECT 1`
//          measured 525ms.
//   :5432  session mode (DIRECT_URL) — prepared statements work, so the same query
//          is a single round trip: ~97ms measured.
//
// Session mode holds a real Postgres connection for the lifetime of the client
// connection, so it is only safe for a long-lived server process (local `node
// server.js`, Render, any container). Serverless functions must stay on the
// transaction pooler or they will exhaust the connection limit.
const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTIONS_WORKER_RUNTIME
);

const baseUrl = isServerless
  ? process.env.DATABASE_URL
  : process.env.DIRECT_URL || process.env.DATABASE_URL;

const datasourceUrl = baseUrl
  ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}connection_limit=10&pool_timeout=10&connect_timeout=10`
  : undefined;

let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient({ datasourceUrl });
} else {
  if (!globalThis.prisma) {
    globalThis.prisma = new PrismaClient({ datasourceUrl });
  }
  prisma = globalThis.prisma;
}

// Warm up the connection pool on startup (avoids cold-start latency on first request)
prisma.$connect().catch((e) => console.error("Prisma connect error:", e));

export default prisma;
