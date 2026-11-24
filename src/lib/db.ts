import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Set DATABASE_URL before starting the application.");
  const adapter = new PrismaPg({ connectionString, max: 6, pipeline: true }, { schema: "app" });
  return new PrismaClient({ adapter });
}

const shared = globalThis as typeof globalThis & { betterLifeDb?: PrismaClient };
let productionClient: PrismaClient | undefined;

function getClient() {
  if (process.env.NODE_ENV !== "production") {
    shared.betterLifeDb ??= createClient();
    return shared.betterLifeDb;
  }
  productionClient ??= createClient();
  return productionClient;
}

// Importing this module must not open a connection. Next evaluates route modules while collecting the build.
export const db = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getClient();
    const value: unknown = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
