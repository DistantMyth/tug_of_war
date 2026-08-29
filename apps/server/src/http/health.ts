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

