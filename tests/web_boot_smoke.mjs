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
  const criticalRuntimeError = /call_indirect|signature mismatch|null function|WebAssembly|RuntimeError|out of bounds memory/i;

  page.on("pageerror", error => {
    if (criticalRuntimeError.test(error.message)) {
      failures.push(`page error: ${error.message}`);
    } else {
      console.warn(`${name} non-fatal page warning: ${error.message}`);
    }
  });
  page.on("console", message => {
    if (message.type() === "error" && criticalRuntimeError.test(message.text())) {
      failures.push(`console error: ${message.text()}`);
    }
  });
  page.on("requestfailed", request => {
    if (/\.(?:js|wasm|pck)(?:\?|$)/.test(request.url())) {
      failures.push(`runtime request failed: ${request.url()} (${request.failure()?.errorText || "unknown"})`);
    }
  });

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
