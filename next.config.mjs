/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep external so Next doesn't try to bundle them: puppeteer/chromium are
  // heavy, and pdf-parse's pdfjs-dist worker relies on resolving its own file
  // path at runtime (breaks if bundled).
  serverExternalPackages: ["puppeteer", "puppeteer-core", "@sparticuz/chromium", "pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
