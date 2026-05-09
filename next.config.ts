import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@cursor/sdk"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
