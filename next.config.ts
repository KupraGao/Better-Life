import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

// Static CSP cannot rotate a nonce. Next.js documents 'unsafe-inline' for that case.
// 'unsafe-eval' is added only when NODE_ENV is development. Production omits it.
// The `/` → `/ka` redirect lives in src/proxy.ts and repeats this same header list.
// redirects() finishes with resHeaders cleared, so a config redirect cannot carry it.

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders() },
      {
        source: "/api/media/:path*",
        headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; sandbox" }],
      },
    ];
  },
};

export default nextConfig;
