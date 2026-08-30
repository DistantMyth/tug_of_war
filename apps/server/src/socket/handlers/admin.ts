import type {
  AdminAutoBalancePayload,
  AdminConfirmPayload,
  AdminExtendPayload,
  AdminOpenPayload,
  AdminSetWildcardPayload,
  ErrorCode,
} from "@tow/shared";
import type { GameOrchestrator } from "../../engine/orchestrator/GameOrchestrator.js";
import { logger } from "../../obs/logger.js";
import { verifyAdminSecret } from "../adminAuth.js";
import type { GameNamespace, GameSocket } from "../types.js";

export type AdminHandlerContext = {
  orchestrator: GameOrchestrator;
};

export function registerAdminHandlers(
  socket: GameSocket,
  _namespace: GameNamespace,
  context: AdminHandlerContext,
): void {
  const { orchestrator } = context;

  function requireAdminAuth(candidateToken?: string): boolean {
    if (socket.data.role === "admin") {
      return true;
    }
    const auth = socket.handshake.auth ?? {};
    const query = socket.handshake.query ?? {};

    const candidate =
      candidateToken ??
      (typeof auth.adminToken === "string" ? auth.adminToken : undefined) ??
      (typeof auth.password === "string" ? auth.password : undefined) ??
      (typeof auth.secret === "string" ? auth.secret : undefined) ??
      (typeof query.adminToken === "string" ? (query.adminToken as string) : undefined);

    return verifyAdminSecret(candidate);
  }

  // ==========================================
  // EVENT: admin:open
  // ==========================================
  socket.on("admin:open" as any, async (payload: AdminOpenPayload & { adminToken?: string }, callback?: (ack: any) => void) => {
    try {
      if (!requireAdminAuth(payload?.adminToken)) {
        logger.warn("admin_open_unauthorized", { socketId: socket.id });
        const errAck = { ok: false, code: "UNAUTHORIZED" as ErrorCode, message: "Admin authorization required" };
        if (callback) callback(errAck);
        return;
      }

      const result = await orchestrator.openGame({ durationMs: payload?.durationMs });
      if (!result.ok) {
        if (callback) callback(result);
        return;
      }

      if (callback) callback({ ok: true, data: result.data });
    } catch (err) {
      logger.error("admin_open_error", { error: String(err) });
      if (callback) callback({ ok: false, code: "VALIDATION", message: "Failed to open game" });
    }
  });

  // ==========================================
  // EVENT: admin:lock
  // ==========================================
  socket.on("admin:lock" as any, async (payload: { adminToken?: string }, callback?: (ack: any) => void) => {
    try {
      if (!requireAdminAuth(payload?.adminToken)) {
        logger.warn("admin_lock_unauthorized", { socketId: socket.id });
        const errAck = { ok: false, code: "UNAUTHORIZED" as ErrorCode, message: "Admin authorization required" };
        if (callback) callback(errAck);
        return;
      }

      const result = await orchestrator.lockGame();
      if (callback) callback(result);
    } catch (err) {
      logger.error("admin_lock_error", { error: String(err) });
      if (callback) callback({ ok: false, code: "VALIDATION", message: "Failed to lock game" });
    }
  });

  // ==========================================
  // EVENT: admin:set_wildcard
  // ==========================================
  socket.on(
    "admin:set_wildcard" as any,
    async (payload: AdminSetWildcardPayload & { adminToken?: string }, callback?: (ack: any) => void) => {
      try {
        if (!requireAdminAuth(payload?.adminToken)) {
          const errAck = { ok: false, code: "UNAUTHORIZED" as ErrorCode, message: "Admin authorization required" };
          if (callback) callback(errAck);
          return;
        }

        if (!payload || typeof payload.playerId !== "string") {
          if (callback) callback({ ok: false, code: "VALIDATION", message: "Missing playerId" });
          return;
        }

        const result = await orchestrator.selectWildcard(payload.playerId);
        if (callback) callback(result);
      } catch (err) {
        logger.error("admin_set_wildcard_error", { error: String(err) });
        if (callback) callback({ ok: false, code: "VALIDATION", message: "Failed to set wildcard" });
      }
    },
  );

  // ==========================================
  // EVENT: admin:auto_balance
  // ==========================================
  socket.on(
    "admin:auto_balance" as any,
    async (payload: AdminAutoBalancePayload & { adminToken?: string }, callback?: (ack: any) => void) => {
      try {
        if (!requireAdminAuth(payload?.adminToken)) {
          const errAck = { ok: false, code: "UNAUTHORIZED" as ErrorCode, message: "Admin authorization required" };
          if (callback) callback(errAck);
          return;
        }

        if (payload?.preview) {
          const previewResult = await orchestrator.previewAutoBalance();
          if (callback) callback(previewResult);
          return;
        }

        if (payload?.confirm) {
          const confirmResult = await orchestrator.confirmAutoBalance();
          if (callback) callback(confirmResult);
          return;
        }

        // Default: return preview
        const result = await orchestrator.previewAutoBalance();
        if (callback) callback(result);
      } catch (err) {
        logger.error("admin_auto_balance_error", { error: String(err) });
        if (callback) callback({ ok: false, code: "VALIDATION", message: "Failed to process auto-balance" });
      }
    },
  );

  // ==========================================
  // EVENT: admin:cancel_balance
  // ==========================================
  socket.on("admin:cancel_balance" as any, async (payload: { adminToken?: string }, callback?: (ack: any) => void) => {
    try {
      if (!requireAdminAuth(payload?.adminToken)) {
        const errAck = { ok: false, code: "UNAUTHORIZED" as ErrorCode, message: "Admin authorization required" };
        if (callback) callback(errAck);
        return;
      }

      const result = await orchestrator.cancelBalancing();
      if (callback) callback(result);
    } catch (err) {
      logger.error("admin_cancel_balance_error", { error: String(err) });
      if (callback) callback({ ok: false, code: "VALIDATION", message: "Failed to cancel balance" });
    }
  });

  // ==========================================
  // EVENT: admin:start_countdown
  // ==========================================
  socket.on(
    "admin:start_countdown" as any,
    async (payload: { durationMs?: number; adminToken?: string }, callback?: (ack: any) => void) => {
      try {
        if (!requireAdminAuth(payload?.adminToken)) {
          const errAck = { ok: false, code: "UNAUTHORIZED" as ErrorCode, message: "Admin authorization required" };
          if (callback) callback(errAck);
          return;
        }

        const result = await orchestrator.startCountdown(payload?.durationMs ?? 3000);
        if (callback) callback(result);
      } catch (err) {
        logger.error("admin_start_countdown_error", { error: String(err) });
        if (callback) callback({ ok: false, code: "VALIDATION", message: "Failed to start countdown" });
      }
    },
  );

  // ==========================================
  // EVENT: admin:pause (PHASE 7)
  // ==========================================
  socket.on("admin:pause" as any, async (payload: { adminToken?: string }, callback?: (ack: any) => void) => {
    try {
      if (!requireAdminAuth(payload?.adminToken)) {
        const errAck = { ok: false, code: "UNAUTHORIZED" as ErrorCode, message: "Admin authorization required" };
        if (callback) callback(errAck);
        return;
      }

      const result = await orchestrator.pauseGame();
      if (callback) callback(result);
    } catch (err) {
      logger.error("admin_pause_error", { error: String(err) });
      if (callback) callback({ ok: false, code: "VALIDATION", message: "Failed to pause game" });
    }
  });

  // ==========================================
  // EVENT: admin:resume (PHASE 7)
  // ==========================================
  socket.on("admin:resume" as any, async (payload: { adminToken?: string }, callback?: (ack: any) => void) => {
    try {
      if (!requireAdminAuth(payload?.adminToken)) {
        const errAck = { ok: false, code: "UNAUTHORIZED" as ErrorCode, message: "Admin authorization required" };
        if (callback) callback(errAck);
        return;
      }

      const result = await orchestrator.resumeGame();
      if (callback) callback(result);
    } catch (err) {
      logger.error("admin_resume_error", { error: String(err) });
      if (callback) callback({ ok: false, code: "VALIDATION", message: "Failed to resume game" });
    }
  });

  // ==========================================
  // EVENT: admin:extend (PHASE 7)
  // ==========================================
  socket.on(
    "admin:extend" as any,
    async (payload: AdminExtendPayload & { adminToken?: string }, callback?: (ack: any) => void) => {
      try {
        if (!requireAdminAuth(payload?.adminToken)) {
          const errAck = { ok: false, code: "UNAUTHORIZED" as ErrorCode, message: "Admin authorization required" };
          if (callback) callback(errAck);
          return;
        }

        if (!payload || !payload.seconds) {
          if (callback) callback({ ok: false, code: "VALIDATION", message: "Missing seconds parameter (5, 10, 15)" });
          return;
        }

        const result = await orchestrator.extendTime(payload.seconds);
        if (callback) callback(result);
      } catch (err) {
        logger.error("admin_extend_error", { error: String(err) });
        if (callback) callback({ ok: false, code: "VALIDATION", message: "Failed to extend time" });
      }
    },
  );

  // ==========================================
  // EVENT: admin:end_round (PHASE 8)
  // ==========================================
  socket.on("admin:end_round" as any, async (payload: { adminToken?: string }, callback?: (ack: any) => void) => {
    try {
      if (!requireAdminAuth(payload?.adminToken)) {
        const errAck = { ok: false, code: "UNAUTHORIZED" as ErrorCode, message: "Admin authorization required" };
        if (callback) callback(errAck);
        return;
      }

      const result = await orchestrator.finishGame("host");
      if (callback) callback(result);
    } catch (err) {
      logger.error("admin_end_round_error", { error: String(err) });
      if (callback) callback({ ok: false, code: "VALIDATION", message: "Failed to end round" });
    }
  });

  // ==========================================
  // EVENT: admin:play_again (PHASE 8)
  // ==========================================
  socket.on(
    "admin:play_again" as any,
    async (payload: { durationMs?: number; adminToken?: string }, callback?: (ack: any) => void) => {
      try {
        if (!requireAdminAuth(payload?.adminToken)) {
          const errAck = { ok: false, code: "UNAUTHORIZED" as ErrorCode, message: "Admin authorization required" };
          if (callback) callback(errAck);
          return;
        }

        const result = await orchestrator.prepareNextRound({ durationMs: payload?.durationMs });
        if (callback) callback(result);
      } catch (err) {
        logger.error("admin_play_again_error", { error: String(err) });
        if (callback) callback({ ok: false, code: "VALIDATION", message: "Failed to start next round" });
      }
    },
  );

  // ==========================================
  // EVENT: admin:emergency_stop
  // ==========================================
  socket.on("admin:emergency_stop" as any, async (payload: { adminToken?: string }, callback?: (ack: any) => void) => {
    try {
      if (!requireAdminAuth(payload?.adminToken)) {
        const errAck = { ok: false, code: "UNAUTHORIZED" as ErrorCode, message: "Admin authorization required" };
        if (callback) callback(errAck);
        return;
      }

      const result = await orchestrator.emergencyStop();
      if (callback) callback(result);
    } catch (err) {
      logger.error("admin_emergency_stop_error", { error: String(err) });
      if (callback) callback({ ok: false, code: "VALIDATION", message: "Failed to execute emergency stop" });
    }
  });

  // ==========================================
  // EVENT: admin:end_event
  // ==========================================
  socket.on("admin:end_event" as any, async (payload: { adminToken?: string }, callback?: (ack: any) => void) => {
    try {
      if (!requireAdminAuth(payload?.adminToken)) {
        const errAck = { ok: false, code: "UNAUTHORIZED" as ErrorCode, message: "Admin authorization required" };
        if (callback) callback(errAck);
        return;
      }

      const result = await orchestrator.endEvent();
      if (callback) callback(result);
    } catch (err) {
      logger.error("admin_end_event_error", { error: String(err) });
      if (callback) callback({ ok: false, code: "VALIDATION", message: "Failed to end event" });
    }
  });

  // ==========================================
  // EVENT: admin:reset_session
  // ==========================================
  socket.on("admin:reset_session" as any, async (payload: { adminToken?: string }, callback?: (ack: any) => void) => {
    try {
      if (!requireAdminAuth(payload?.adminToken)) {
        const errAck = { ok: false, code: "UNAUTHORIZED" as ErrorCode, message: "Admin authorization required" };
        if (callback) callback(errAck);
        return;
      }

      const result = await orchestrator.resetSession();
      if (callback) callback(result);
    } catch (err) {
      logger.error("admin_reset_session_error", { error: String(err) });
      if (callback) callback({ ok: false, code: "VALIDATION", message: "Failed to reset session" });
    }
  });

  // ==========================================
  // EVENT: admin:shuffle_play
  // ==========================================
  socket.on("admin:shuffle_play" as any, async (payload: { durationMs?: number; adminToken?: string }, callback?: (ack: any) => void) => {
    try {
      if (!requireAdminAuth(payload?.adminToken)) {
        const errAck = { ok: false, code: "UNAUTHORIZED" as ErrorCode, message: "Admin authorization required" };
        if (callback) callback(errAck);
        return;
      }

      const result = await orchestrator.openGame({ durationMs: payload?.durationMs });
      if (callback) callback(result);
    } catch (err) {
      logger.error("admin_shuffle_play_error", { error: String(err) });
      if (callback) callback({ ok: false, code: "VALIDATION", message: "Failed to shuffle play" });
    }
  });
}
