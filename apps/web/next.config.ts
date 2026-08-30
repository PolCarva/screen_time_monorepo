import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  transpilePackages: ["@screen-time/contracts"],
  experimental: {
    typedEnv: true,
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
