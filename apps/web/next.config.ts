import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // yjs, lib0, y-protocols use ESM patterns that need explicit transpilation
  transpilePackages: ["yjs", "lib0", "y-protocols"],
};

export default nextConfig;
