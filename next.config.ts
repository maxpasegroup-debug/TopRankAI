import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: { "/*": ["./syllabus/*/*.txt"] },
  // These were previously set by `middleware.ts`. Next 16 ships the legacy
  // middleware entry as an unbundled Node module on Vercel, which fails on the
  // extensionless `next/server` import. Static headers keep the same policy
  // without a request-time proxy.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "x-content-type-options", value: "nosniff" },
          { key: "x-frame-options", value: "DENY" },
          { key: "referrer-policy", value: "strict-origin-when-cross-origin" },
          { key: "permissions-policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/shared/achievements/:path*",
        headers: [
          { key: "referrer-policy", value: "no-referrer" },
          { key: "cache-control", value: "private, no-store" },
        ],
      },
    ];
  },
  distDir: process.env.TOPRANK_VERIFY_BUILD === "phase10" ? ".next/phase10-verification" : process.env.TOPRANK_VERIFY_BUILD === "phase9" ? ".next/phase9-verification" : process.env.TOPRANK_VERIFY_BUILD === "phase8" ? ".next/phase8-verification" : process.env.TOPRANK_VERIFY_BUILD === "phase7" ? ".next/phase7-verification" : process.env.TOPRANK_VERIFY_BUILD === "phase6" ? ".next/phase6-verification" : process.env.TOPRANK_VERIFY_BUILD === "phase5" ? ".next/phase5-verification" : process.env.TOPRANK_VERIFY_BUILD === "phase4" ? ".next/phase4-verification" : process.env.TOPRANK_VERIFY_BUILD === "studio" ? ".next/studio-verification" : process.env.TOPRANK_VERIFY_BUILD === "phase3" ? ".next/phase3-verification" : process.env.TOPRANK_VERIFY_BUILD === "true" ? ".next/phase2-verification" : ".next",
};

if (process.env.TOPRANK_VERIFY_BUILD === "infrastructure") {
  nextConfig.distDir = ".next/infrastructure-verification";
}
if (process.env.TOPRANK_VERIFY_BUILD === "accounts") {
  nextConfig.distDir = ".next/accounts-verification";
}
if (process.env.TOPRANK_VERIFY_BUILD === "pin") {
  nextConfig.distDir = ".next/pin-verification";
}

export default nextConfig;
