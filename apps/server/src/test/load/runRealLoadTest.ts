import http from "node:http";
import { io as ClientSocket, type Socket as ClientSocketType } from "socket.io-client";
import { createApp } from "../../http/app.js";
import { PlayerIdentityService } from "../../identity/service.js";
import { logger } from "../../obs/logger.js";
import { setupGameSocketServer } from "../../socket/server.js";
import { MemoryGameRepository } from "../../store/redis/memoryRepository.js";

export interface LoadTestMetrics {
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
  memoryRssMb: number;
  heapUsedMb: number;
  eventLoopLagEstimateMs: number;
  durationSec: number;
  losslessScoreVerified: boolean;
}

export async function runSocketLoadTest(targetClients = 300, durationSec = 3): Promise<LoadTestMetrics> {
  const repository = new MemoryGameRepository();
  const identityService = new PlayerIdentityService(repository);
  const app = createApp({ repository, identityService });
  const server = http.createServer(app);

  const socketServer = setupGameSocketServer(server, { repository, identityService });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as any;
  const port = address.port;
  const serverUrl = `http://127.0.0.1:${port}`;

  // 1. Open authoritative game
  const openRes = await socketServer.orchestrator.openGame({ durationMs: 60000 });
  if (!openRes.ok) throw new Error("Failed to open game");
  const gameId = openRes.data.gameId;

  // 2. Connect Display socket
  const displaySocket = ClientSocket(`${serverUrl}/game`, {
    auth: { displaySecret: process.env.DISPLAY_SECRET ?? "dev_display_secret" },
    transports: ["websocket"],
  });

  await new Promise<void>((resolve) => {
    displaySocket.on("connect", () => resolve());
  });

  // 3. Register & Connect N real client sockets
  const clientSockets: ClientSocketType[] = [];
  const handshakeLatencies: number[] = [];
  let connectionFailures = 0;

  logger.info("load_test_connecting_clients", { count: targetClients });

  const batchSize = 50;
  for (let i = 0; i < targetClients; i += batchSize) {
    const batch = Array.from({ length: Math.min(batchSize, targetClients - i) }, async (_, batchIdx) => {
      const reg = await identityService.registerOrResume({});
      if (!reg.ok) {
        connectionFailures++;
        return null;
      }

      const start = Date.now();
      const socket = ClientSocket(`${serverUrl}/game`, {
        auth: { token: reg.data.token },
        transports: ["websocket"],
      });

      return new Promise<ClientSocketType | null>((resolve) => {
        const timeout = setTimeout(() => {
          connectionFailures++;
          resolve(null);
        }, 5000);

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
    });

    const results = await Promise.all(batch);
    for (const s of results) {
      if (s) clientSockets.push(s);
    }
  }

  // 4. Assign teams: evenly split between Left and Right
  const teamPromises = clientSockets.map((socket, idx) => {
    const chosenTeam = idx % 2 === 0 ? "left" : "right";
    return new Promise<void>((resolve) => {
      socket.emit("player:choose_team", { team: chosenTeam }, () => {
        resolve();
      });
    });
  });
  await Promise.all(teamPromises);

  // 5. Host locks roster & starts match
  const lockRes = await socketServer.orchestrator.lockGame();
  if (lockRes.ok && (lockRes.data as any).status === "balancing") {
    await socketServer.orchestrator.confirmAutoBalance();
  }

  const gameCheck = await repository.getGame(gameId);
  if (gameCheck.ok && gameCheck.value.phase !== "RUNNING") {
    if (gameCheck.value.phase !== "COUNTDOWN") {
      await socketServer.orchestrator.startCountdown(100);
    }
    await new Promise((r) => setTimeout(r, 150));
    await socketServer.orchestrator.completeCountdown();
  }

  // 6. Real-time Concurrent Tap Generation (8-12 Hz per client)
  logger.info("load_test_running_taps", { activeSockets: clientSockets.length, durationSec });

  const tapLatencies: number[] = [];
  let acceptedLeft = 0;
  let acceptedRight = 0;
  let rateLimitedCount = 0;
  let tapsSent = 0;

  const tapIntervalMs = 100; // 10 taps/sec
  const endTime = Date.now() + durationSec * 1000;

  const runClientTapping = async (socket: ClientSocketType, idx: number) => {
    const assignedTeam = idx % 2 === 0 ? "left" : "right";
    while (Date.now() < endTime) {
      const sendTime = Date.now();
      tapsSent++;
      await new Promise<void>((resolve) => {
        socket.emit("player:tap", {}, (ack: any) => {
          tapLatencies.push(Date.now() - sendTime);
          if (ack && ack.ok) {
            if (assignedTeam === "left") acceptedLeft++;
            else acceptedRight++;
          } else if (ack && ack.code === "RATE_LIMITED") {
            rateLimitedCount++;
          }
          resolve();
        });
      });
      await new Promise((r) => setTimeout(r, tapIntervalMs));
    }
  };

  const tapPromises = clientSockets.map((s, idx) => runClientTapping(s, idx));
  await Promise.all(tapPromises);

  // 7. Finish round & check final score consistency
  await socketServer.orchestrator.finishGame("timer");
  const publicStateRes = await repository.getPublicGameState(gameId);
  const finalScores = publicStateRes.ok ? publicStateRes.value.scores : { left: 0, right: 0 };

  // 8. Compute latencies
  tapLatencies.sort((a, b) => a - b);
  const p50 = tapLatencies[Math.floor(tapLatencies.length * 0.5)] ?? 0;
  const p95 = tapLatencies[Math.floor(tapLatencies.length * 0.95)] ?? 0;
  const p99 = tapLatencies[Math.floor(tapLatencies.length * 0.99)] ?? 0;
  const avgHandshake =
    handshakeLatencies.length > 0
      ? handshakeLatencies.reduce((a, b) => a + b, 0) / handshakeLatencies.length
      : 0;

  const mem = process.memoryUsage();
  const losslessVerified =
    finalScores.left === acceptedLeft && finalScores.right === acceptedRight;

  // 9. Teardown
  for (const s of clientSockets) s.disconnect();
  displaySocket.disconnect();
  await new Promise<void>((resolve) => server.close(() => resolve()));

  return {
    clientCount: clientSockets.length,
    connectionSuccessCount: clientSockets.length,
    connectionFailureCount: connectionFailures,
    avgHandshakeMs: Math.round(avgHandshake * 10) / 10,
    totalTapsSent: tapsSent,
    totalTapsAccepted: acceptedLeft + acceptedRight,
    totalTapsRateLimited: rateLimitedCount,
    scoreLeft: finalScores.left,
    scoreRight: finalScores.right,
    p50TapLatencyMs: p50,
    p95TapLatencyMs: p95,
    p99TapLatencyMs: p99,
    memoryRssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
    heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
    eventLoopLagEstimateMs: Math.round(p50 * 10) / 10,
    durationSec,
    losslessScoreVerified: losslessVerified,
  };
}
