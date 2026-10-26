import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "path";

// Load repo-root .env so NEXT_PUBLIC_MAPBOX_TOKEN works from SwipeNest/.env
loadEnvConfig(path.resolve(__dirname, ".."));

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "127.0.0.1", port: "8000" },
      { protocol: "http", hostname: "localhost", port: "8000" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  // Include listing data + images in serverless function bundles on Vercel
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./data/processed/**/*",
      "./data/images/**/*",
      "../data/processed/**/*",
      "../data/images/**/*",
    ],
  },
};

export default nextConfig;
