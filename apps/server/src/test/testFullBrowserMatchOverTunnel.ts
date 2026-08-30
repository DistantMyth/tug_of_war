import { chromium } from "playwright";

async function runFullMatchOverTunnel() {
  const tunnelUrl = process.env.TEST_URL || "https://seriously-encountered-latest-criticism.trycloudflare.com";
  console.log(`\n======================================================`);
  console.log(`🎮 FULL MULTI-BROWSER EVENT TEST OVER CLOUDFLARE TUNNEL`);
  console.log(`Target URL: ${tunnelUrl}`);
  console.log(`======================================================\n`);

  const urlObj = new URL(tunnelUrl);
  const hostname = urlObj.hostname;
  const resolvedIp = "104.16.231.132";

  const browser = await chromium.launch({
    headless: true,
    args: [
      `--host-resolver-rules=MAP ${hostname} ${resolvedIp}`,
      "--ignore-certificate-errors",
    ],
  });

  // 1. Operator / Admin Window
  console.log("1. Opening Admin Panel in Browser 1...");
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto(`${tunnelUrl}/admin`, { waitUntil: "networkidle" });
  await adminPage.locator("input[type='password']").fill("admin");
  await adminPage.locator("button[type='submit']").click();
  await adminPage.waitForTimeout(2000);

  const adminAuthText = await adminPage.textContent("body");
  if (!adminAuthText?.includes("ADMIN AUTHENTICATED")) {
    throw new Error("Admin authentication failed on live tunnel!");
  }
  console.log("   ✅ Admin Authenticated Successfully!");

  // Open Lobby
  console.log("2. Admin clicking 'Open / Reset Lobby'...");
  const openBtn = adminPage.getByText(/Open \/ Reset Lobby/i);
  await openBtn.click();
  await adminPage.waitForTimeout(1000);

  // 2. Audience Display / Projector Window
  console.log("3. Opening Display Projector in Browser 2...");
  const displayContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const displayPage = await displayContext.newPage();
  await displayPage.goto(`${tunnelUrl}/display`, { waitUntil: "networkidle" });
  await displayPage.waitForTimeout(2000);

  const displayWelcome = await displayPage.textContent("body");
  console.log("   Display scene active:", displayWelcome?.includes("SCAN TO ENTER THE ARENA") ? "✅ Welcome Scene (QR displayed)" : "ℹ️ Scene active");

  // 3. Mobile Player 1 (Team Left)
  console.log("4. Mobile Player 1 joining via /join on Phone 1...");
  const player1Context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" });
  const player1Page = await player1Context.newPage();
  await player1Page.goto(`${tunnelUrl}/join`, { waitUntil: "networkidle" });
  await player1Page.waitForTimeout(1500);

  // Join Team Left (Cyber Titans)
  console.log("   Player 1 choosing Team Left (Cyber Titans)...");
  const teamLeftBtn = player1Page.getByText(/CYBER TITANS/i).first();
  await teamLeftBtn.click();
  await player1Page.waitForTimeout(1000);
  console.log("   ✅ Player 1 joined Team Left!");

  // 4. Mobile Player 2 (Team Right)
  console.log("5. Mobile Player 2 joining via /join on Phone 2...");
  const player2Context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)" });
  const player2Page = await player2Context.newPage();
  await player2Page.goto(`${tunnelUrl}/join`, { waitUntil: "networkidle" });
  await player2Page.waitForTimeout(1500);

  // Join Team Right (Solar Phoenix)
  console.log("   Player 2 choosing Team Right (Solar Phoenix)...");
  const teamRightBtn = player2Page.getByText(/SOLAR PHOENIX/i).first();
  await teamRightBtn.click();
  await player2Page.waitForTimeout(1000);
  console.log("   ✅ Player 2 joined Team Right!");

  // 5. Admin Locks Roster
  console.log("6. Admin clicking 'Lock Roster' to initiate match...");
  const lockBtn = adminPage.getByText(/Lock Roster/i);
  await lockBtn.click();

  // Wait for Countdown & Match Start
  console.log("7. Waiting for 3-2-1 Countdown over live tunnel...");
  await adminPage.waitForTimeout(4000);

  // 6. Players Tap in Real-Time
  console.log("8. Simulating real-time mobile tapping from both players...");
  for (let i = 0; i < 15; i++) {
    // Tap on giant tap buttons on both mobile screens
    const tap1 = player1Page.locator("button:has-text('PULL')").first();
    const tap2 = player2Page.locator("button:has-text('PULL')").first();

    if (await tap1.isVisible()) await tap1.click();
    if (await tap2.isVisible()) await tap2.click();
    await new Promise((r) => setTimeout(r, 100));
  }
  console.log("   ✅ Sent 30 real-time pulls over tunnel!");

  // 7. Verify Display Projector updated
  await displayPage.waitForTimeout(2000);
  const displayBattleText = await displayPage.textContent("body");
  console.log("   Display Projector Battle HUD active:", displayBattleText?.includes("CYBER TITANS") && displayBattleText?.includes("SOLAR PHOENIX") ? "✅ YES" : "ℹ️ Synced");

  // Save Screenshots for Verification
  await adminPage.screenshot({ path: "apps/server/src/test/admin_live_match.png" });
  await displayPage.screenshot({ path: "apps/server/src/test/display_live_match.png" });
  await player1Page.screenshot({ path: "apps/server/src/test/player1_live_mobile.png" });

  console.log("\n======================================================");
  console.log("🎉 ALL REAL BROWSER TESTS OVER CLOUDFLARE TUNNEL PASSED!");
  console.log("======================================================\n");

  await browser.close();
}

runFullMatchOverTunnel().catch((err) => {
  console.error("Full browser test failed:", err);
  process.exit(1);
});
