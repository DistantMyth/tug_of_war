import { type Collection, type Db, MongoClient } from "mongodb";
import { logger } from "../../obs/logger.js";
import type {
  AuditEventDocument,
  PlayerDocument,
  RoundDocument,
  SessionDocument,
} from "./types.js";

export class MongoClientService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private isConnected = false;

  constructor(private readonly uri?: string, private readonly dbName = "tug_of_war") {}

  async connect(): Promise<boolean> {
    if (!this.uri) {
      logger.info("mongodb_disabled_no_uri");
      return false;
    }

    try {
      this.client = new MongoClient(this.uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });

      await this.client.connect();
      this.db = this.client.db(this.dbName);
      this.isConnected = true;

      await this.ensureIndexes();
      logger.info("mongodb_connected", { dbName: this.dbName });
      return true;
    } catch (err) {
      this.isConnected = false;
      logger.warn("mongodb_connect_warning", { error: String(err) });
      return false;
    }
  }

  private async ensureIndexes(): Promise<void> {
    if (!this.db) return;
    try {
      await Promise.all([
        this.getSessionsCollection().createIndex({ sessionId: 1 }, { unique: true }),
        this.getPlayersCollection().createIndex({ sessionId: 1, playerId: 1 }, { unique: true }),
        this.getRoundsCollection().createIndex({ sessionId: 1, roundNumber: 1 }, { unique: true }),
        this.getAuditCollection().createIndex({ sessionId: 1, timestamp: 1 }),
      ]);
      logger.info("mongodb_indexes_ensured");
    } catch (err) {
      logger.warn("mongodb_index_creation_warning", { error: String(err) });
    }
  }

  getSessionsCollection(): Collection<SessionDocument> {
    if (!this.db) throw new Error("MongoDB not connected");
    return this.db.collection<SessionDocument>("sessions");
  }

  getPlayersCollection(): Collection<PlayerDocument> {
    if (!this.db) throw new Error("MongoDB not connected");
    return this.db.collection<PlayerDocument>("players");
  }

  getRoundsCollection(): Collection<RoundDocument> {
    if (!this.db) throw new Error("MongoDB not connected");
    return this.db.collection<RoundDocument>("rounds");
  }

  getAuditCollection(): Collection<AuditEventDocument> {
    if (!this.db) throw new Error("MongoDB not connected");
    return this.db.collection<AuditEventDocument>("audit_events");
  }

  getHealth(): { status: "connected" | "disconnected" | "disabled" } {
    if (!this.uri) return { status: "disabled" };
    return { status: this.isConnected ? "connected" : "disconnected" };
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      logger.info("mongodb_closed");
    }
  }
}
