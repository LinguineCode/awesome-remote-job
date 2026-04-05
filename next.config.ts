import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.craigslist.org",
      },
      {
        protocol: "https",
        hostname: "**.autotempest.com",
      },
    ],
  },
};

export default nextConfig;
