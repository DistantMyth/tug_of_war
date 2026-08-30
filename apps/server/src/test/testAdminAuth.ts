import { io } from "socket.io-client";

async function testAdminAuth() {
  const targetUrl = process.env.TEST_URL || "http://localhost:3001/game";
  console.log(`Testing Admin Auth against ${targetUrl}...`);

  const secretsToTest = ["admin", "your-admin-secret-here", "tow-default-admin-secret-dev-only"];

  for (const secret of secretsToTest) {
    console.log(`Attempting auth with secret: '${secret}'...`);
    const socket = io(targetUrl, {
      auth: { role: "admin", adminToken: secret },
      transports: ["polling", "websocket"],
      timeout: 10000,
    });

    const result = await new Promise<{ ok: boolean; message?: string }>((resolve) => {
      socket.once("connect", () => {
        socket.disconnect();
        resolve({ ok: true });
      });
      socket.once("connect_error", (err) => {
        resolve({ ok: false, message: err.message });
      });
      setTimeout(() => resolve({ ok: false, message: "Connection timed out" }), 11000);
    });

    console.log(`Secret '${secret}':`, result.ok ? "✅ SUCCESS" : `❌ FAILED (${result.message})`);
    if (!result.ok) {
      process.exit(1);
    }
  }

  console.log("\n🎉 ALL ADMIN SECRETS AUTHENTICATED SUCCESSFULLY OVER TUNNEL!");
  process.exit(0);
}

testAdminAuth().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
