import { Router } from "express";
import { buildHealthReport, type DependencyStatus } from "../obs/health.js";
import { checkRedisHealth } from "../store/redis/client.js";

let connectionCountProvider = () => 0;
let mongoStatusProvider: () => DependencyStatus = () => "not_configured";

export function setConnectionCountProvider(provider: () => number): void {
  connectionCountProvider = provider;
}

export function setMongoStatusProvider(provider: () => DependencyStatus): void {
  mongoStatusProvider = provider;
}

export const healthRouter = Router();

import os from "node:os";

export function getPrimaryLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal && !iface.address.startsWith("127.")) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

healthRouter.get("/health", async (_req, res) => {
  const redisStatus = await checkRedisHealth();
  const report = buildHealthReport({
    redis: redisStatus,
    mongo: mongoStatusProvider(),
    phase: null,
    connections: connectionCountProvider(),
    uptime: process.uptime(),
  });
  res.status(report.ok ? 200 : 503).json(report);
});

healthRouter.get("/api/network", (_req, res) => {
  const localIp = getPrimaryLocalIp();
  const port = Number(process.env.PORT ?? 3001);
  const publicUrl = process.env.PUBLIC_URL || process.env.TUNNEL_URL || null;
  const joinUrl = publicUrl ? `${publicUrl.replace(/\/+$/, "")}/join` : `http://${localIp}:${port}/join`;
  res.json({
    ok: true,
    localIp,
    port,
    publicUrl,
    joinUrl,
  });
});

