import path from "path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@rumo/core", "@rumo/theme"],
  outputFileTracingRoot: path.join(__dirname),
}

export default nextConfig;
