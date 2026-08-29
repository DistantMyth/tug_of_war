import { Router } from "express";
import type { PlayerIdentityService } from "../identity/service.js";

export function createSessionRouter(identityService: PlayerIdentityService): Router {
  const router = Router();

  router.get("/api/session/current", async (_req, res) => {
    try {
      const sessionInfo = await identityService.getCurrentSessionInfo();
      res.status(200).json({
        ok: true,
        data: sessionInfo,
      });
    } catch {
      res.status(500).json({
        ok: false,
        code: "VALIDATION",
        message: "Internal server error reading active session",
      });
    }
  });

  return router;
}
