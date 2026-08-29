import { Redis, type RedisOptions } from "ioredis";
import { logger } from "../../obs/logger.js";
import type { DependencyStatus } from "../../obs/health.js";

let defaultClient: Redis | null = null;

export function isRedisConfigured(): boolean {
  const url = process.env.REDIS_URL;
  return Boolean(url && url.trim().length > 0);
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "***";
    }
    return parsed.toString();
  } catch {
    return "[invalid-url]";
  }
}

export function createRedisClient(urlOrOptions?: string | RedisOptions): Redis {
  const target = urlOrOptions ?? process.env.REDIS_URL;

  const defaultOptions: RedisOptions = {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  };

  let client: Redis;
  if (typeof target === "string") {
    client = new Redis(target, defaultOptions);
    logger.info("redis_client_created", { url: sanitizeUrl(target) });
  } else if (target && typeof target === "object") {
    client = new Redis({ ...defaultOptions, ...target });
    logger.info("redis_client_created", { host: target.host, port: target.port });
  } else {
    client = new Redis(defaultOptions);
    logger.info("redis_client_created", { mode: "default_localhost" });
  }

  client.on("connect", () => {
    logger.info("redis_connected");
  });

  client.on("ready", () => {
    logger.info("redis_ready");
  });

  client.on("error", (err) => {
    logger.error("redis_error", { error: String(err) });
  });

  client.on("close", () => {
    logger.warn("redis_closed");
  });

  client.on("reconnecting", (delay: number) => {
    logger.info("redis_reconnecting", { delayMs: delay });
  });

  return client;
}

export function getRedisClient(): Redis {
  if (!defaultClient) {
    defaultClient = createRedisClient();
  }
  return defaultClient;
}

export async function checkRedisHealth(client?: Redis): Promise<DependencyStatus> {
  if (!isRedisConfigured() && !client) {
    return "not_configured";
  }
  const target = client ?? getRedisClient();
  try {
    if (target.status === "wait") {
      await target.connect();
    }
    const response = await target.ping();
    return response === "PONG" ? "ok" : "down";
  } catch {
    return "down";
  }
}

export async function closeRedisClient(): Promise<void> {
  if (defaultClient) {
    try {
      await defaultClient.quit();
    } catch {
      defaultClient.disconnect();
    }
    defaultClient = null;
  }
}
