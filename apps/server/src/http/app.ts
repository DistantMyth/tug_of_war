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
  const origin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

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
      origin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use(healthRouter);
  app.use(createPlayerRouter(identityService));
  app.use(createSessionRouter(identityService));

  return app;
}
