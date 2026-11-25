import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = dirname(fileURLToPath(import.meta.url));

// The repository root is also a Next app. Turbopack uses that root and compiles
// BetterLife src/proxy.ts. Dev Host scripts pass --webpack so this app is the only entry.
const nextConfig: NextConfig = {
  turbopack: { root: join(appDir, "../..") },
  transpilePackages: ["@kupragao/lms-contracts", "@kupragao/lms-core", "@kupragao/lms-ui"],
  poweredByHeader: false,
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
