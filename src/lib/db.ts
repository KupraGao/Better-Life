import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Set DATABASE_URL before starting the application.");
  const adapter = new PrismaPg({ connectionString, max: 6 }, { schema: "app" });
  return new PrismaClient({ adapter });
}

const shared = globalThis as typeof globalThis & { betterLifeDb?: PrismaClient };
export const db = shared.betterLifeDb ?? createClient();
if (process.env.NODE_ENV !== "production") shared.betterLifeDb = db;
