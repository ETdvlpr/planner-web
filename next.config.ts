import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloud-first client: every page is a client component talking to
  // planner-api with a Firebase token, so nothing is server-rendered with
  // data and there are no route handlers. Vercel serves the static shell.
  reactStrictMode: true,
  agentRules: false,
  poweredByHeader: false,
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
        // Sign-in popups (Google/Apple) need window.opener; COOP must stay
        // `same-origin-allow-popups` or Firebase's popup flow breaks.
        { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
      ],
    },
  ],
};

export default nextConfig;
