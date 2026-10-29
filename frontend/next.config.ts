import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    qualities: [75, 90],
    dangerouslyAllowSVG: true,
  },
  // Árvore de rotas única: /owner/properties|tenants foi consolidada em /properties|tenants.
  async redirects() {
    return [
      { source: "/owner/properties", destination: "/properties", permanent: true },
      { source: "/owner/properties/:path*", destination: "/properties/:path*", permanent: true },
      { source: "/owner/tenants", destination: "/tenants", permanent: true },
      { source: "/owner/tenants/:path*", destination: "/tenants/:path*", permanent: true },
    ];
  },
};

const sentryConfig = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
};

export default withSentryConfig(nextConfig, sentryConfig);