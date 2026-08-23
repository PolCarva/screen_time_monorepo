import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@screen-time/contracts"],
  experimental: {
    typedEnv: true,
  },
};

export default nextConfig;
