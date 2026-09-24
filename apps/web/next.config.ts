import type { NextConfig } from "next";

import { createSecurityHeaders } from "./lib/security-headers";

const securityHeaders = createSecurityHeaders();

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@screen-time/contracts"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [{ source: "/impact", destination: "/impacto", permanent: true }];
  },
  images: { formats: ["image/avif", "image/webp"] },
  experimental: {
    // Visitors from search arrive once: the CSS (~14 KB) comes with the HTML
    // instead of blocking the first paint (docs/landing-seo-plan.md, F5).
    inlineCss: true,
    typedEnv: true,
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
