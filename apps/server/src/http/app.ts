import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { PlayerIdentityService } from "../identity/service.js";
import { getRedisClient, isRedisConfigured } from "../store/redis/client.js";
import { MemoryGameRepository } from "../store/redis/memoryRepository.js";
import { RedisGameRepository } from "../store/redis/repository.js";
import { healthRouter } from "./health.js";
import { createPlayerRouter } from "./player.js";
import { createSessionRouter } from "./session.js";

export type AppOptions = {
  identityService?: PlayerIdentityService;
  repository?: RedisGameRepository | MemoryGameRepository;
};

export function createApp(options?: AppOptions): express.Express {
  const app = express();
  const origin = process.env.CLIENT_ORIGIN || true;

  const repo =
    options?.repository ??
    (isRedisConfigured()
      ? new RedisGameRepository(getRedisClient())
      : new MemoryGameRepository());

  const identityService = options?.identityService ?? new PlayerIdentityService(repo);

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: origin === "*" ? true : origin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use(healthRouter);
  app.use(createPlayerRouter(identityService));
  app.use(createSessionRouter(identityService));

  // Serve static web build if present (for single-port laptop hosting and tunneling)
  const possibleDistPaths = [
    path.resolve(process.cwd(), "apps/web/dist"),
    path.resolve(process.cwd(), "../web/dist"),
    path.resolve(process.cwd(), "dist"),
  ];

  const staticDir = possibleDistPaths.find((p) => fs.existsSync(path.join(p, "index.html")));
  if (staticDir) {
    app.use(express.static(staticDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/health") || req.path.startsWith("/socket.io")) {
        return next();
      }
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  return app;
}
