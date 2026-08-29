import { describe, expect, it } from "vitest";
import { runSocketLoadTest } from "./runRealLoadTest.js";

describe("LOCAL SOCKET.IO LOAD TEST (300 & 500 Clients)", () => {
  it(
    "executes 300 real client sockets with 10 taps/sec and verifies zero lost score increments",
    async () => {
      const metrics = await runSocketLoadTest(300, 3);

      console.log("\n==================================================");
      console.log("LOCAL SOCKET.IO LOAD TEST RESULTS (300 CLIENTS)");
      console.log("==================================================");
      console.log("ENVIRONMENT=LOCAL");
      console.log("Target Server:          Local in-memory ephemeral test harness");
      console.log(`Connected Clients:      ${metrics.clientCount}/300 (100% success)`);
      console.log(`Avg Handshake Latency:  ${metrics.avgHandshakeMs} ms`);
      console.log(`Total Taps Processed:   ${metrics.totalTapsSent}`);
      console.log(`Accepted Taps:          ${metrics.totalTapsAccepted}`);
      console.log(`Rate-limited Taps:      ${metrics.totalTapsRateLimited}`);
      console.log(`Final Scores:           Left: ${metrics.scoreLeft}, Right: ${metrics.scoreRight}`);
      console.log(`Tap Latency (p50):      ${metrics.p50TapLatencyMs} ms`);
      console.log(`Tap Latency (p95):      ${metrics.p95TapLatencyMs} ms`);
      console.log(`Tap Latency (p99):      ${metrics.p99TapLatencyMs} ms`);
      console.log(`Memory RSS / Heap:      ${metrics.memoryRssMb} MB / ${metrics.heapUsedMb} MB`);
      console.log(`Lossless Score Match:   ${metrics.losslessScoreVerified ? "VERIFIED (100%)" : "FAILED"}`);
      console.log("==================================================\n");

      expect(metrics.clientCount).toBe(300);
      expect(metrics.connectionFailureCount).toBe(0);
      expect(metrics.totalTapsAccepted).toBeGreaterThan(0);
      expect(metrics.losslessScoreVerified).toBe(true);
      expect(metrics.p95TapLatencyMs).toBeLessThan(100);
    },
    30000,
  );

  it(
    "attempts 500 real client sockets and records capacity metrics",
    async () => {
      const metrics = await runSocketLoadTest(500, 2);

      console.log("\n==================================================");
      console.log("LOCAL SOCKET.IO LOAD TEST RESULTS (500 CLIENTS)");
      console.log("==================================================");
      console.log("ENVIRONMENT=LOCAL");
      console.log("Target Server:          Local in-memory ephemeral test harness");
      console.log(`Connected Clients:      ${metrics.clientCount}/500`);
      console.log(`Avg Handshake Latency:  ${metrics.avgHandshakeMs} ms`);
      console.log(`Total Taps Processed:   ${metrics.totalTapsSent}`);
      console.log(`Accepted Taps:          ${metrics.totalTapsAccepted}`);
      console.log(`Final Scores:           Left: ${metrics.scoreLeft}, Right: ${metrics.scoreRight}`);
      console.log(`Tap Latency (p50):      ${metrics.p50TapLatencyMs} ms`);
      console.log(`Tap Latency (p95):      ${metrics.p95TapLatencyMs} ms`);
      console.log(`Tap Latency (p99):      ${metrics.p99TapLatencyMs} ms`);
      console.log(`Memory RSS / Heap:      ${metrics.memoryRssMb} MB / ${metrics.heapUsedMb} MB`);
      console.log(`Lossless Score Match:   ${metrics.losslessScoreVerified ? "VERIFIED (100%)" : "FAILED"}`);
      console.log("==================================================\n");

      expect(metrics.clientCount).toBe(500);
      expect(metrics.losslessScoreVerified).toBe(true);
    },
    45000,
  );
});
