import { Router } from "express";
import type { PlayerIdentityService } from "../identity/service.js";

export function createPlayerRouter(identityService: PlayerIdentityService): Router {
  const router = Router();

  router.post("/api/player/register", async (req, res) => {
    try {
      const token = typeof req.body?.token === "string" ? req.body.token : undefined;
      const result = await identityService.registerOrResume({ token });

      if (!result.ok) {
        let status = 400;
        if (result.code === "UNAUTHORIZED") {
          status = 401;
        } else if (result.code === "GAME_NOT_FOUND" || result.code === "UNKNOWN_PLAYER") {
          status = 404;
        } else if (result.code === "JOIN_CLOSED" || result.code === "SESSION_REPLACED") {
          status = 409;
        }
        res.status(status).json({
          ok: false,
          code: result.code,
          message: result.message,
        });
        return;
      }

      res.status(200).json({
        ok: true,
        data: result.data,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        code: "VALIDATION",
        message: "Internal server error during registration",
      });
    }
  });

  return router;
}
