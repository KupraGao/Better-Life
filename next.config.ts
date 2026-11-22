import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  async redirects() {
    return [{ source: "/", destination: "/ka", permanent: false }];
  },
};

export default nextConfig;
