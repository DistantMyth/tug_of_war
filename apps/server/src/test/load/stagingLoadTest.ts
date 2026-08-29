/**
 * Staging / Production Socket.IO Load Testing CLI Runner
 *
 * Runs a real multi-client load test against a deployed staging or production backend.
 * Configured via environment variables:
 * - LOADTEST_BASE_URL (e.g. https://tow-game-server.onrender.com or http://localhost:3001)
 * - LOADTEST_ADMIN_SECRET
 * - LOADTEST_DISPLAY_SECRET
 * - LOADTEST_CLIENT_COUNT (default 300)
 * - LOADTEST_DURATION_SEC (default 5)
 */

import { io as ClientSocket, type Socket as ClientSocketType } from "socket.io-client";

interface StagingMetrics {
  clientCount: number;
  connectionSuccessCount: number;
  connectionFailureCount: number;
  avgHandshakeMs: number;
  totalTapsSent: number;
  totalTapsAccepted: number;
  totalTapsRateLimited: number;
  scoreLeft: number;
  scoreRight: number;
  p50TapLatencyMs: number;
  p95TapLatencyMs: number;
  p99TapLatencyMs: number;
  durationSec: number;
  losslessScoreVerified: boolean;
}

export async function runStagingLoadTest(): Promise<StagingMetrics> {
  const baseUrl = (process.env.LOADTEST_BASE_URL ?? "http://localhost:3001").replace(/\/+$/, "");
  const adminSecret = process.env.LOADTEST_ADMIN_SECRET ?? process.env.ADMIN_PASSWORD ?? "dev_admin_password";
  const displaySecret = process.env.LOADTEST_DISPLAY_SECRET ?? process.env.DISPLAY_SECRET ?? "dev_display_secret";
  const targetClients = Number.parseInt(process.env.LOADTEST_CLIENT_COUNT ?? "300", 10);
  const durationSec = Number.parseInt(process.env.LOADTEST_DURATION_SEC ?? "5", 10);

  const isLocal = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");
  const environmentLabel = isLocal ? "LOCAL" : "STAGING";

  console.log("\n==================================================");
  console.log(`STAGING/PRODUCTION SOCKET.IO LOAD TEST (${targetClients} CLIENTS)`);
  console.log("==================================================");
  console.log(`ENVIRONMENT=${environmentLabel}`);
  console.log(`Target Base URL:        ${baseUrl}`);
  console.log(`Target Clients:         ${targetClients}`);
  console.log(`Duration:               ${durationSec}s`);
  console.log("==================================================\n");

  // 1. Connect Admin Socket
  const adminSocket = ClientSocket(`${baseUrl}/game`, {
    auth: { role: "admin", adminToken: adminSecret },
    transports: ["websocket"],
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Admin socket connection timeout")), 10000);
    adminSocket.on("connect", () => {
      clearTimeout(timeout);
      resolve();
    });
    adminSocket.on("connect_error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // 2. Open game session via Admin Socket
  await new Promise<void>((resolve, reject) => {
    adminSocket.emit("admin:open", { durationMs: 60000 }, (ack: any) => {
      if (ack && ack.ok) resolve();
      else reject(new Error(ack?.message ?? "Failed to open game"));
    });
  });

  // 3. Connect Display Socket
  const displaySocket = ClientSocket(`${baseUrl}/game`, {
    auth: { role: "display", displaySecret },
    transports: ["websocket"],
  });

  await new Promise<void>((resolve) => {
    displaySocket.on("connect", () => resolve());
  });

  // 4. Register & Connect Client Sockets
  const clientSockets: ClientSocketType[] = [];
  const handshakeLatencies: number[] = [];
  let connectionFailures = 0;

  const batchSize = 50;
  for (let i = 0; i < targetClients; i += batchSize) {
    const batch = Array.from({ length: Math.min(batchSize, targetClients - i) }, async (_, batchIdx) => {
      const start = Date.now();
      try {
        const regRes = await fetch(`${baseUrl}/api/players/bootstrap`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        if (!regRes.ok) {
          connectionFailures++;
          return null;
        }

        const regData = (await regRes.json()) as { token: string };
        const socket = ClientSocket(`${baseUrl}/game`, {
          auth: { token: regData.token },
          transports: ["websocket"],
        });

        return new Promise<ClientSocketType | null>((resolve) => {
          const timeout = setTimeout(() => {
            connectionFailures++;
            resolve(null);
          }, 10000);

          socket.on("connect", () => {
            clearTimeout(timeout);
            handshakeLatencies.push(Date.now() - start);
            resolve(socket);
          });

          socket.on("connect_error", () => {
            clearTimeout(timeout);
            connectionFailures++;
            resolve(null);
          });
        });
      } catch {
        connectionFailures++;
        return null;
      }
    });

    const results = await Promise.all(batch);
    for (const sock of results) {
      if (sock) clientSockets.push(sock);
    }
  }

  // 5. Choose teams
  const teamPromises = clientSockets.map((sock, idx) => {
    const targetTeam = idx % 2 === 0 ? "left" : "right";
    return new Promise<void>((resolve) => {
      sock.emit("player:choose_team", { team: targetTeam }, () => resolve());
    });
  });
  await Promise.all(teamPromises);

  // 6. Lock roster and countdown
  await new Promise<void>((resolve) => {
    adminSocket.emit("admin:lock", {}, () => resolve());
  });
  await new Promise((r) => setTimeout(r, 200));

  await new Promise<void>((resolve) => {
    adminSocket.emit("admin:auto_balance", {}, () => resolve());
  });
  await new Promise((r) => setTimeout(r, 1000));

  // 7. Run real-time taps
  let totalTapsSent = 0;
  let totalTapsAccepted = 0;
  let totalTapsRateLimited = 0;
  const tapLatencies: number[] = [];

  const tapIntervals = clientSockets.map((sock) => {
    return setInterval(() => {
      totalTapsSent++;
      const tapStart = Date.now();
      sock.emit("player:tap", {}, (ack: any) => {
        tapLatencies.push(Date.now() - tapStart);
        if (ack && ack.ok) totalTapsAccepted++;
        else if (ack && ack.code === "RATE_LIMITED") totalTapsRateLimited++;
      });
    }, 100); // 10 Hz per client
  });

  await new Promise((r) => setTimeout(r, durationSec * 1000));
  for (const iv of tapIntervals) clearInterval(iv);
  await new Promise((r) => setTimeout(r, 600));

  // 8. End game and get results
  let finalLeft = 0;
  let finalRight = 0;
  await new Promise<void>((resolve) => {
    adminSocket.emit("admin:end_round", {}, (ack: any) => {
      if (ack && ack.data) {
        finalLeft = ack.data.left;
        finalRight = ack.data.right;
      }
      resolve();
    });
  });

  // Clean up sockets
  for (const s of clientSockets) s.disconnect();
  displaySocket.disconnect();
  adminSocket.disconnect();

  tapLatencies.sort((a, b) => a - b);
  const p50 = tapLatencies[Math.floor(tapLatencies.length * 0.5)] ?? 0;
  const p95 = tapLatencies[Math.floor(tapLatencies.length * 0.95)] ?? 0;
  const p99 = tapLatencies[Math.floor(tapLatencies.length * 0.99)] ?? 0;

  const avgHandshake =
    handshakeLatencies.length > 0
      ? Math.round((handshakeLatencies.reduce((a, b) => a + b, 0) / handshakeLatencies.length) * 10) / 10
      : 0;

  const losslessMatch = totalTapsAccepted === finalLeft + finalRight;

  const metrics: StagingMetrics = {
    clientCount: clientSockets.length,
    connectionSuccessCount: clientSockets.length,
    connectionFailureCount: connectionFailures,
    avgHandshakeMs: avgHandshake,
    totalTapsSent,
    totalTapsAccepted,
    totalTapsRateLimited,
    scoreLeft: finalLeft,
    scoreRight: finalRight,
    p50TapLatencyMs: p50,
    p95TapLatencyMs: p95,
    p99TapLatencyMs: p99,
    durationSec,
    losslessScoreVerified: losslessMatch,
  };

  console.log("\n==================================================");
  console.log(`LOAD TEST EXECUTION COMPLETED`);
  console.log("==================================================");
  console.log(`ENVIRONMENT=${environmentLabel}`);
  console.log(`Connected Clients:      ${metrics.clientCount}/${targetClients}`);
  console.log(`Avg Handshake Latency:  ${metrics.avgHandshakeMs} ms`);
  console.log(`Total Taps Processed:   ${metrics.totalTapsSent}`);
  console.log(`Accepted Taps:          ${metrics.totalTapsAccepted}`);
  console.log(`Rate-limited Taps:      ${metrics.totalTapsRateLimited}`);
  console.log(`Final Scores:           Left: ${metrics.scoreLeft}, Right: ${metrics.scoreRight}`);
  console.log(`Tap Latency (p50):      ${metrics.p50TapLatencyMs} ms`);
  console.log(`Tap Latency (p95):      ${metrics.p95TapLatencyMs} ms`);
  console.log(`Tap Latency (p99):      ${metrics.p99TapLatencyMs} ms`);
  console.log(`Lossless Score Match:   ${metrics.losslessScoreVerified ? "VERIFIED (100%)" : "FAILED"}`);
  console.log("==================================================\n");

  return metrics;
}

if (process.argv[1]?.endsWith("stagingLoadTest.ts") || process.argv[1]?.endsWith("stagingLoadTest.js")) {
  runStagingLoadTest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Staging load test error:", err);
      process.exit(1);
    });
}
