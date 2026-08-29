import "dotenv/config";
import http from "node:http";
import { createApp } from "./http/app.js";
import { setConnectionCountProvider, setMongoStatusProvider } from "./http/health.js";
import { logger } from "./obs/logger.js";
import { setupGameSocketServer } from "./socket/server.js";
import { PlayerIdentityService } from "./identity/service.js";
import { MongoClientService } from "./store/mongo/client.js";
import { MongoPersistenceService } from "./store/mongo/persistenceService.js";
import { closeRedisClient, getRedisClient, isRedisConfigured } from "./store/redis/client.js";
import { MemoryGameRepository } from "./store/redis/memoryRepository.js";
import { RedisGameRepository } from "./store/redis/repository.js";

// ==================================================
// 1. PRODUCTION CONFIGURATION VALIDATION
// ==================================================
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  const missingSecrets: string[] = [];
  if (!process.env.PLAYER_TOKEN_SECRET || process.env.PLAYER_TOKEN_SECRET.length < 16) {
    missingSecrets.push("PLAYER_TOKEN_SECRET (min 16 chars)");
  }
  if (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_SECRET) {
    missingSecrets.push("ADMIN_PASSWORD / ADMIN_SECRET");
  }
  if (!process.env.DISPLAY_SECRET && !process.env.DISPLAY_PIN) {
    missingSecrets.push("DISPLAY_SECRET / DISPLAY_PIN");
  }

  if (missingSecrets.length > 0) {
    logger.error("production_config_validation_failed", { missingSecrets });
    console.error(`FATAL: Missing production secrets: ${missingSecrets.join(", ")}`);
    process.exit(1);
  }
}

// ==================================================
// 2. INITIALIZE MONGO & PERSISTENCE
// ==================================================
const mongoUri = process.env.MONGODB_URI;
const mongoClient = new MongoClientService(mongoUri);
const persistenceService = new MongoPersistenceService(mongoClient);

if (mongoUri) {
  mongoClient.connect().then((connected) => {
    if (connected) {
      setMongoStatusProvider(() => "ok");
    } else {
      setMongoStatusProvider(() => "down");
    }
  }).catch(() => {
    setMongoStatusProvider(() => "down");
  });
} else {
  setMongoStatusProvider(() => "not_configured");
}

// ==================================================
// 3. REPOSITORY & IDENTITY INITIALIZATION
// ==================================================
const repository = isRedisConfigured()
  ? new RedisGameRepository(getRedisClient())
  : new MemoryGameRepository();

const identityService = new PlayerIdentityService(repository);

// ==================================================
// 4. HTTP & SOCKET SERVER INITIALIZATION
// ==================================================
const port = Number(process.env.PORT ?? 3001);
const app = createApp({ repository, identityService });
const server = http.createServer(app);

const socketResult = setupGameSocketServer(server, {
  repository,
  identityService,
  persistenceService,
});

setConnectionCountProvider(() => socketResult.connectionManager.getConnectionCount());

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    logger.error("server_port_in_use", { port, hint: "Kill the existing process or change PORT env var" });
    console.error(
      `\nFATAL: Port ${port} is already in use.\n` +
      `Run: netstat -ano | findstr :${port}  (Windows) or lsof -ti:${port} | xargs kill  (Mac/Linux)\n`,
    );
  } else {
    logger.error("server_listen_error", { error: String(err) });
    console.error(`Server error: ${err.message}`);
  }
  process.exit(1);
});

server.listen(port, () => {
  logger.info("server_listening", {
    port,
    env: process.env.NODE_ENV ?? "development",
    redisConfigured: isRedisConfigured(),
    mongoConfigured: Boolean(mongoUri),
  });
});

// ==================================================
// 4. GRACEFUL SHUTDOWN
// ==================================================
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info("graceful_shutdown_started", { signal });

  // 1. Stop timer manager and score broadcaster
  try {
    socketResult.orchestrator.timerManager.dispose();
  } catch (err) {
    logger.warn("shutdown_timer_cleanup_error", { error: String(err) });
  }

  // 2. Drain / Flush Mongo persistence queue
  try {
    await persistenceService.flush();
    logger.info("shutdown_persistence_flushed");
  } catch (err) {
    logger.warn("shutdown_persistence_flush_error", { error: String(err) });
  }

  // 3. Close Socket.IO server
  try {
    socketResult.io.close();
    logger.info("shutdown_socket_server_closed");
  } catch (err) {
    logger.warn("shutdown_socket_close_error", { error: String(err) });
  }

  // 4. Close HTTP server
  server.close(async (err) => {
    if (err) {
      logger.error("shutdown_http_close_error", { error: String(err) });
    } else {
      logger.info("shutdown_http_server_closed");
    }

    // 5. Close DB connections without deleting Redis state
    try {
      await mongoClient.close();
      await closeRedisClient();
    } catch (dbErr) {
      logger.warn("shutdown_db_close_error", { error: String(dbErr) });
    }

    logger.info("graceful_shutdown_completed");
    process.exit(err ? 1 : 0);
  });

  // Force exit safety timeout (5 seconds)
  setTimeout(() => {
    logger.error("shutdown_timeout_forced_exit");
    process.exit(1);
  }, 5000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
