import type { Browser } from "puppeteer-core";
import { TailoredResume } from "./resumeSchema";
import { renderResumeHtml, FIT_STEPS } from "@/templates/resume.html";

const MM_TO_PX = 96 / 25.4;
const PRINTABLE_W = Math.floor((210 - 30) * MM_TO_PX); // ~680px
const PRINTABLE_H = Math.floor((297 - 28) * MM_TO_PX); // ~1016px

const IS_SERVERLESS = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

/**
 * Launch a browser. On Vercel/Lambda, the full `puppeteer` package's bundled
 * Chromium isn't available at runtime (it lives outside the deployed
 * function), so we use `@sparticuz/chromium` + `puppeteer-core` instead — a
 * Chromium build packaged specifically to fit inside serverless functions.
 * Locally, plain `puppeteer` (bundles its own Chromium) is simplest.
 */
async function launchBrowser(): Promise<Browser> {
  if (IS_SERVERLESS) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteerCore = await import("puppeteer-core");
    return puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const puppeteer = (await import("puppeteer")).default;
  try {
    return (await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })) as unknown as Browser;
  } catch (e: any) {
    if (process.platform === "darwin" && e.message && (e.message.includes("-88") || e.message.includes("ENOENT"))) {
      console.warn("Falling back to system Chrome due to puppeteer launch error:", e.message);
      return (await puppeteer.launch({
        headless: true,
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      })) as unknown as Browser;
    }
    throw e;
  }
}

/**
 * Render tailored resume JSON to a one-page PDF buffer with auto-fit: try each
 * fit step (looser -> tighter) and keep the first that fits one printable page.
 */
export async function renderResumePdf(resume: TailoredResume): Promise<Buffer> {
  let browser: Browser | undefined;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: PRINTABLE_W, height: PRINTABLE_H, deviceScaleFactor: 1 });

    let chosen = FIT_STEPS[FIT_STEPS.length - 1];
    for (const step of FIT_STEPS) {
      await page.setContent(renderResumeHtml(resume, step), { waitUntil: "networkidle0" });
      const height = await page.evaluate(() => document.body.scrollHeight);
      if (height <= PRINTABLE_H) {
        chosen = step;
        break;
      }
    }

    await page.setContent(renderResumeHtml(resume, chosen), { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    if (browser) await browser.close();
  }
}

export function resumeFilename(resume: TailoredResume): string {
  return `${(resume.name || "resume").replace(/[^a-z0-9]+/gi, "_")}_resume.pdf`;
}
