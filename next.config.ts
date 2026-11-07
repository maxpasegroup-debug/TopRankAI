import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.TOPRANK_VERIFY_BUILD === "phase10" ? ".next/phase10-verification" : process.env.TOPRANK_VERIFY_BUILD === "phase9" ? ".next/phase9-verification" : process.env.TOPRANK_VERIFY_BUILD === "phase8" ? ".next/phase8-verification" : process.env.TOPRANK_VERIFY_BUILD === "phase7" ? ".next/phase7-verification" : process.env.TOPRANK_VERIFY_BUILD === "phase6" ? ".next/phase6-verification" : process.env.TOPRANK_VERIFY_BUILD === "phase5" ? ".next/phase5-verification" : process.env.TOPRANK_VERIFY_BUILD === "phase4" ? ".next/phase4-verification" : process.env.TOPRANK_VERIFY_BUILD === "studio" ? ".next/studio-verification" : process.env.TOPRANK_VERIFY_BUILD === "phase3" ? ".next/phase3-verification" : process.env.TOPRANK_VERIFY_BUILD === "true" ? ".next/phase2-verification" : ".next",
};

if (process.env.TOPRANK_VERIFY_BUILD === "infrastructure") {
  nextConfig.distDir = ".next/infrastructure-verification";
}
if (process.env.TOPRANK_VERIFY_BUILD === "accounts") {
  nextConfig.distDir = ".next/accounts-verification";
}

export default nextConfig;
