import type { Browser } from "puppeteer-core";
import fs from "fs";
import { TailoredResume } from "./resumeSchema";
import { renderResumeHtml, FIT_STEPS } from "@/templates/resume.html";

/**
 * A4 = 210×297mm. With @page margin:0 and .resume padding handled by CSS,
 * the printable height is the full A4 height. Puppeteer uses 96 DPI.
 */
const MM_TO_PX = 96 / 25.4;
const PRINTABLE_W = Math.floor(210 * MM_TO_PX);   // 794px
const PRINTABLE_H = Math.floor(297 * MM_TO_PX);   // 1123px

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
      
      const paths = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi",
        "/Applications/Chromium.app/Contents/MacOS/Chromium"
      ];
      
      let executablePath = "";
      for (const p of paths) {
        if (fs.existsSync(p)) {
          executablePath = p;
          break;
        }
      }
      
      if (!executablePath) {
        throw new Error("No compatible Chromium browser found. Please install Google Chrome, Brave, or Microsoft Edge to generate PDFs.");
      }

      return (await puppeteer.launch({
        headless: true,
        executablePath,
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
      await page.setContent(renderResumeHtml(resume, step), { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      const height = await page.evaluate(() => document.body.scrollHeight);
      if (height <= PRINTABLE_H) {
        chosen = step;
        break;
      }
    }

    await page.setContent(renderResumeHtml(resume, chosen), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    if (browser) await browser.close();
  }
}

export function resumeFilename(resume: TailoredResume): string {
  return `${(resume.name || "resume").replace(/[^a-z0-9]+/gi, "_")}_resume.pdf`;
}
