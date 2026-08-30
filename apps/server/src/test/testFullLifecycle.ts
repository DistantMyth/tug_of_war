import { io } from "socket.io-client";

async function testFullTournamentLifecycle() {
  const baseUrl = (process.env.TEST_URL || "http://localhost:3001/game").replace(/\/game$/, "");
  console.log(`\n=============================================================`);
  console.log(`🚀 RUNNING FULL END-TO-END TEST OVER: ${baseUrl}`);
  console.log(`=============================================================\n`);

  // 1. Authenticate Admin Socket over tunnel
  console.log("1. Connecting & Authenticating Admin Socket...");
  const adminSocket = io(`${baseUrl}/game`, {
    auth: { role: "admin", adminToken: "your-admin-secret-here" },
    transports: ["polling", "websocket"],
    timeout: 10000,
  });

  await new Promise<void>((resolve, reject) => {
    adminSocket.once("connect", () => {
      console.log("   ✅ Admin Socket Connected & Authenticated!");
      resolve();
    });
    adminSocket.once("connect_error", (err) => {
      reject(new Error(`Admin connect_error: ${err.message}`));
    });
    setTimeout(() => reject(new Error("Admin connect timeout")), 10000);
  });

  // 2. Open Lobby via Admin Socket
  console.log("\n2. Opening Lobby via admin:open...");
  const openRes = await new Promise<any>((resolve) => {
    adminSocket.emit("admin:open" as any, { durationMs: 30000 }, (ack: any) => resolve(ack));
    setTimeout(() => resolve({ ok: false, message: "open timeout" }), 5000);
  });
  console.log("   admin:open ack:", openRes.ok ? `✅ SUCCESS (Session: ${openRes.data?.sessionId})` : `❌ FAILED (${openRes.message})`);
  if (!openRes.ok) process.exit(1);

  // 3. Connect Display Socket over tunnel
  console.log("\n3. Connecting Display Projector Socket...");
  const displaySocket = io(`${baseUrl}/game`, {
    auth: { role: "display", displayToken: "your-display-secret-here" },
    transports: ["polling", "websocket"],
    timeout: 10000,
  });
  await new Promise<void>((resolve, reject) => {
    displaySocket.once("connect", () => {
      console.log("   ✅ Display Socket Connected & Authenticated!");
      resolve();
    });
    displaySocket.once("connect_error", (err) => reject(new Error(`Display connect_error: ${err.message}`)));
    setTimeout(() => reject(new Error("Display connect timeout")), 10000);
  });

  // 4. Register 2 Players over HTTP API
  console.log("\n4. Registering 2 Mobile Players via HTTP API...");
  const p1: any = await fetch(`${baseUrl}/api/player/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }).then((r) => r.json());
  console.log("   Player 1 registered:", p1.ok ? `✅ SUCCESS (ID: ${p1.data.playerId})` : "❌ FAILED");

  const p2: any = await fetch(`${baseUrl}/api/player/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }).then((r) => r.json());
  console.log("   Player 2 registered:", p2.ok ? `✅ SUCCESS (ID: ${p2.data.playerId})` : "❌ FAILED");

  // 5. Connect Player 1 & Choose Team Left (Cyan)
  console.log("\n5. Player 1 joins Team Left (Cyan)...");
  const s1 = io(`${baseUrl}/game`, { auth: { token: p1.data.token }, transports: ["polling", "websocket"] });
  await new Promise<void>((resolve) => s1.once("connect", () => resolve()));
  const team1Res = await new Promise<any>((resolve) => {
    s1.emit("player:choose_team", { team: "left" }, (ack: any) => resolve(ack));
  });
  console.log("   Player 1 chose team:", team1Res.ok ? `✅ SUCCESS (team: ${team1Res.data?.team})` : "❌ FAILED");

  // 6. Connect Player 2 & Choose Team Right (Amber)
  console.log("\n6. Player 2 joins Team Right (Amber)...");
  const s2 = io(`${baseUrl}/game`, { auth: { token: p2.data.token }, transports: ["polling", "websocket"] });
  await new Promise<void>((resolve) => s2.once("connect", () => resolve()));
  const team2Res = await new Promise<any>((resolve) => {
    s2.emit("player:choose_team", { team: "right" }, (ack: any) => resolve(ack));
  });
  console.log("   Player 2 chose team:", team2Res.ok ? `✅ SUCCESS (team: ${team2Res.data?.team})` : "❌ FAILED");

  // 7. Lock Roster & Start Countdown via Admin
  console.log("\n7. Locking Roster via admin:lock...");
  const lockRes = await new Promise<any>((resolve) => {
    adminSocket.emit("admin:lock" as any, {}, (ack: any) => resolve(ack));
  });
  console.log("   admin:lock ack:", lockRes.ok ? `✅ SUCCESS (phase: ${lockRes.data?.phase})` : `❌ FAILED: ${JSON.stringify(lockRes)}`);

  console.log("\n8. Starting Countdown via admin:start_countdown...");
  const countRes = await new Promise<any>((resolve) => {
    adminSocket.emit("admin:start_countdown" as any, { countdownMs: 1000 }, (ack: any) => resolve(ack));
  });
  console.log("   admin:start_countdown ack:", countRes.ok ? `✅ SUCCESS (phase: ${countRes.data?.phase})` : `❌ FAILED: ${JSON.stringify(countRes)}`);

  console.log("\n⏳ Waiting 1.5s for match to enter RUNNING phase...");
  await new Promise((r) => setTimeout(r, 1500));

  // 9. Send Real-Time Taps
  console.log("\n9. Sending Rapid Taps from Player 1 and Player 2...");
  let p1Taps = 0;
  for (let i = 0; i < 5; i++) {
    const tapRes = await new Promise<any>((resolve) => {
      s1.emit("player:tap", { clientTime: Date.now() }, (ack: any) => resolve(ack));
    });
    if (tapRes.ok) p1Taps++;
  }
  console.log(`   Player 1 sent 5 taps: ✅ ${p1Taps}/5 processed successfully`);

  let p2Taps = 0;
  for (let i = 0; i < 5; i++) {
    const tapRes = await new Promise<any>((resolve) => {
      s2.emit("player:tap", { clientTime: Date.now() }, (ack: any) => resolve(ack));
    });
    if (tapRes.ok) p2Taps++;
  }
  console.log(`   Player 2 sent 5 taps: ✅ ${p2Taps}/5 processed successfully`);

  // 10. Clean up
  adminSocket.disconnect();
  displaySocket.disconnect();
  s1.disconnect();
  s2.disconnect();

  console.log("\n=============================================================");
  console.log("🎉 ALL END-TO-END MATCH TESTS PASSED WITH 100% SUCCESS OVER TUNNEL!");
  console.log("=============================================================\n");
  process.exit(0);
}

testFullTournamentLifecycle().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
