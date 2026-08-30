import { io } from "socket.io-client";

async function testParticipantFlow() {
  const baseUrl = (process.env.TEST_URL || "http://localhost:3001/game").replace(/\/game$/, "");
  console.log(`Testing Participant Flow against ${baseUrl}...`);

  // 1. Register / Get Participant Session Token via HTTP API
  const regRes = await fetch(`${baseUrl}/api/player/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }).then((r) => r.json());

  console.log("POST /api/player/register:", regRes.ok ? `✅ SUCCESS (playerId: ${regRes.data?.playerId})` : `❌ FAILED: ${JSON.stringify(regRes)}`);
  if (!regRes.ok || !regRes.data?.token) {
    process.exit(1);
  }

  const token = regRes.data.token;

  // 2. Connect Player Socket with auth token
  const socket = io(`${baseUrl}/game`, {
    auth: { token },
    transports: ["polling", "websocket"],
    timeout: 10000,
  });

  const connected = await new Promise<boolean>((resolve) => {
    socket.once("connect", () => resolve(true));
    socket.once("connect_error", (err) => {
      console.error("Connect error:", err.message);
      resolve(false);
    });
    setTimeout(() => resolve(false), 10000);
  });

  if (!connected) {
    console.error("❌ Failed to connect player socket");
    process.exit(1);
  }
  console.log("✅ Player socket connected with token");

  // 3. Emit player:hello
  const helloRes = await new Promise<any>((resolve) => {
    socket.emit("player:hello", { token }, (ack: any) => {
      resolve(ack);
    });
    setTimeout(() => resolve({ ok: false, message: "hello timeout" }), 5000);
  });

  console.log("player:hello ack:", helloRes.ok ? "✅ SUCCESS" : `❌ FAILED (${helloRes.message})`);
  if (!helloRes.ok) {
    process.exit(1);
  }

  socket.disconnect();
  console.log("\n🎉 FULL PARTICIPANT FLOW TESTED AND VERIFIED OVER TUNNEL!");
  process.exit(0);
}

testParticipantFlow().catch((err) => {
  console.error("Participant test error:", err);
  process.exit(1);
});
