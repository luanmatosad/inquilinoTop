import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  environment: process.env.NEXT_PUBLIC_APP_ENV || "development",

  release: process.env.NEXT_PUBLIC_APP_VERSION,

  integrations: [
    Sentry.replayIntegration(),
    Sentry.feedbackIntegration({ colorScheme: "system" }),
  ],

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  _experiments: { enableLogs: true },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
