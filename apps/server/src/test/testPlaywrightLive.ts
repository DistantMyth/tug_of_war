import { chromium } from "playwright";

async function runLiveBrowserTest() {
  const tunnelUrl = process.env.TEST_URL || "https://smith-excuse-hip-affair.trycloudflare.com";
  console.log(`\n======================================================`);
  console.log(`🌐 PLAYWRIGHT REAL BROWSER TEST`);
  console.log(`Target URL: ${tunnelUrl}/admin`);
  console.log(`======================================================\n`);

  const urlObj = new URL(tunnelUrl);
  const hostname = urlObj.hostname;

  // Query Cloudflare DNS (1.1.1.1) to get the IP
  let resolvedIp = "104.16.231.132";

  const browser = await chromium.launch({
    headless: true,
    args: [
      `--host-resolver-rules=MAP ${hostname} ${resolvedIp}`,
      "--ignore-certificate-errors",
    ],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("console", (msg) => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });

  page.on("pageerror", (err) => {
    console.error(`[BROWSER UNCAUGHT ERROR]`, err);
  });

  page.on("requestfailed", (req) => {
    console.warn(`[REQUEST FAILED] ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });

  page.on("response", (res) => {
    if (res.url().includes("socket.io") || res.url().includes("api")) {
      console.log(`[HTTP RESPONSE] ${res.status()} ${res.url()}`);
    }
  });

  console.log("1. Navigating to /admin...");
  await page.goto(`${tunnelUrl}/admin`, { waitUntil: "networkidle" });

  console.log("2. Checking page title and header...");
  const title = await page.title();
  console.log("   Page Title:", title);

  const header = await page.textContent("h1");
  console.log("   Heading:", header);

  console.log("3. Locating password input and Auth button...");
  const passwordInput = page.locator("input[type='password']");
  const authButton = page.locator("button[type='submit']");

  await passwordInput.fill("admin");
  console.log("   Filled password: 'admin'");

  console.log("4. Clicking Auth button...");
  await authButton.click();

  // Wait for 3 seconds to observe socket connection and UI update
  await page.waitForTimeout(3000);

  const bodyText = await page.textContent("body");
  const isAuthenticated = bodyText?.includes("ADMIN AUTHENTICATED");
  const isAuthFailed = bodyText?.includes("AUTH FAILED");

  console.log("\n======================================================");
  console.log("RESULT IN REAL CHROMIUM BROWSER:");
  console.log("Is ADMIN AUTHENTICATED present?", isAuthenticated ? "✅ YES" : "❌ NO");
  console.log("Is AUTH FAILED present?", isAuthFailed ? "❌ YES" : "✅ NO");
  console.log("======================================================\n");

  await page.screenshot({ path: "apps/server/src/test/admin_screenshot.png" });
  console.log("📸 Screenshot saved to apps/server/src/test/admin_screenshot.png");

  await browser.close();

  if (!isAuthenticated) {
    console.error("Test failed: Browser did not authenticate as admin!");
    process.exit(1);
  }
}

runLiveBrowserTest().catch((err) => {
  console.error("Playwright test crashed:", err);
  process.exit(1);
});
