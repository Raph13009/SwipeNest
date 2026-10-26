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
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    return [
      {
        source: "/backend-api/:path*",
        destination: `${api}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
