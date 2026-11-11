import type { NextConfig } from "next";

// Static export: every page is pre-built to HTML from the JSON files
// src/export_static.py writes (public/data/), and the site is rebuilt after
// each refresh. NEXT_PUBLIC_BASE_PATH is set when the site lives under a
// subpath -- GitHub Pages serves this repo at /SportsPredictor.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: "export",
  // /results/nfl/ -> results/nfl/index.html, which static hosts serve as-is.
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;
