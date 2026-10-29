import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    qualities: [75, 90],
    dangerouslyAllowSVG: true,
  },
  // Árvore de rotas única: /owner/properties|tenants|contracts foi consolidada em /properties|tenants|leases.
  async redirects() {
    return [
      { source: "/owner/properties", destination: "/properties", permanent: true },
      { source: "/owner/properties/:path*", destination: "/properties/:path*", permanent: true },
      { source: "/owner/tenants", destination: "/tenants", permanent: true },
      { source: "/owner/tenants/:path*", destination: "/tenants/:path*", permanent: true },
      // /payments e /expenses viram as telas financeiras (criação de despesa e cobrança fica nelas).
      { source: "/payments", destination: "/financial/receivables", permanent: true },
      { source: "/expenses", destination: "/financial/payables", permanent: true },
      { source: "/owner/contracts", destination: "/leases", permanent: true },
      { source: "/owner/contracts/new", destination: "/leases", permanent: true },
      { source: "/owner/contracts/:path*", destination: "/leases/:path*", permanent: true },
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