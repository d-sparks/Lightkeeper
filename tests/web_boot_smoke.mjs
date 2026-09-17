import { chromium, webkit } from "playwright";

const target = process.env.LIGHTKEEPER_TEST_URL || "http://127.0.0.1:8000/";
const engines = [["Chromium", chromium], ["WebKit", webkit]];

for (const [name, browserType] of engines) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const failures = [];

  page.on("pageerror", error => failures.push(`page error: ${error.message}`));
  page.on("requestfailed", request => failures.push(
    `request failed: ${request.url()} (${request.failure()?.errorText || "unknown"})`
  ));

  await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForFunction(() => {
    const status = document.getElementById("status");
    const notice = document.getElementById("status-notice");
    if (notice?.textContent?.trim()) {
      throw new Error(notice.textContent.trim());
    }
    return status === null;
  }, null, { timeout: 90_000 });

  const canvas = page.locator("#canvas");
  const box = await canvas.boundingBox();
  if (!box || box.width < 100 || box.height < 100) {
    failures.push("Godot canvas did not acquire a playable size");
  }
  if (failures.length) {
    throw new Error(`${name} mobile boot failed:\n${failures.join("\n")}`);
  }
  console.log(`${name} mobile boot passed (${Math.round(box.width)}x${Math.round(box.height)})`);
  await browser.close();
}
