import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  transpilePackages: ["@screen-time/contracts"],
  experimental: {
    typedEnv: true,
  },
};

export default nextConfig;
