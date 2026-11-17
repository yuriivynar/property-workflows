import type { NextConfig } from "next";

// Статичні заголовки безпеки для всіх відповідей. Content-Security-Policy тут не задаємо: їй потрібен nonce на запит —
// її ставить src/proxy.ts (src/lib/security/csp.ts), разом із frame-ancestors 'none'.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  // Не видаємо версію фреймворку в заголовку X-Powered-By.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
