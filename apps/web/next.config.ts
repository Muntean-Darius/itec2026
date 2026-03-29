import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // yjs, lib0, y-protocols are dynamically imported client-side only.
  // No transpilePackages needed — they are ESM and loaded via dynamic import().
  experimental: {
    serverActions: {
      bodySizeLimit: "512mb",
    }
  }
};

export default nextConfig;
