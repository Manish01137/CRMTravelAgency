#!/usr/bin/env node
/**
 * Export brochures to PDF (one 1080×1350 page per brochure page, backgrounds on).
 *
 *   node export.js winter-spiti          → pdf/winter-spiti.pdf
 *   node export.js all                   → every package in packages/list.js
 *   node export.js winter-spiti --pages  → also pdf/winter-spiti/page-01.png … to review each page
 *
 * Waits for fonts and images, and prints any page whose text didn't fit.
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const ROOT = __dirname;
const args = process.argv.slice(2);
const wantPages = args.includes("--pages");
const target = args.find((a) => !a.startsWith("--"));

function packageSlugs() {
  const src = fs.readFileSync(path.join(ROOT, "packages", "list.js"), "utf8");
  const m = src.match(/PACKAGE_LIST\s*=\s*(\[[\s\S]*?\])/);
  if (!m) throw new Error("packages/list.js: couldn't find window.PACKAGE_LIST = [...]");
  return JSON.parse(m[1].replace(/'/g, '"').replace(/,\s*\]/, "]"));
}

async function exportOne(browser, slug) {
  if (!fs.existsSync(path.join(ROOT, "packages", `${slug}.js`))) throw new Error(`packages/${slug}.js not found`);
  const page = await browser.newPage({ viewport: { width: 1140, height: 1400 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const url = pathToFileURL(path.join(ROOT, "template.html")).href + `?pkg=${encodeURIComponent(slug)}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForFunction(() => window.__BROCHURE_READY === true, null, { timeout: 90_000 });
  const warnings = await page.evaluate(() => window.__BROCHURE_WARNINGS || []);
  const pageCount = await page.locator(".page").count();

  fs.mkdirSync(path.join(ROOT, "pdf"), { recursive: true });
  const out = path.join(ROOT, "pdf", `${slug}.pdf`);
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: out, width: "1080px", height: "1350px", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });

  if (wantPages) {
    await page.emulateMedia({ media: "screen" });
    const dir = path.join(ROOT, "pdf", slug);
    fs.mkdirSync(dir, { recursive: true });
    const pages = page.locator(".page");
    for (let i = 0; i < pageCount; i++) await pages.nth(i).screenshot({ path: path.join(dir, `page-${String(i + 1).padStart(2, "0")}.png`) });
  }
  await page.close();

  console.log(`✓ ${slug}: ${pageCount} pages → ${path.relative(process.cwd(), out)}${wantPages ? ` (+ PNGs in pdf/${slug}/)` : ""}`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);
  for (const e of errors) console.log(`  ✗ script error: ${e}`);
  return warnings.length + errors.length;
}

(async () => {
  if (!target) {
    console.log("Usage: node export.js <slug> | all  [--pages]");
    process.exit(1);
  }
  const slugs = target === "all" ? packageSlugs() : [target];
  const browser = await chromium.launch();
  let problems = 0;
  try {
    for (const slug of slugs) {
      try {
        problems += await exportOne(browser, slug);
      } catch (err) {
        problems++;
        console.log(`✗ ${slug}: ${err.message}`);
      }
    }
  } finally {
    await browser.close();
  }
  process.exit(problems ? 2 : 0);
})();
