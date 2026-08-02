import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@grammarcetamol/ui": path.resolve(__dirname, "../ui/src/index.ts"),
    };
    return config;
  },
};

export default nextConfig;
