import type { ErrorCode, PublicState, YouView } from "@tow/shared";
import type { StoredPlayer } from "../store/redis/types.js";

export type PlayerTokenClaims = {
  playerId: string;
  sessionId: string;
  jti: string;
  issuedAt: number;
  expiresAt: number;
};

export type PlayerIdentity = {
  playerId: string;
  label: string;
  sessionId: string;
  token: string;
  player: StoredPlayer;
};

export type RegisterPlayerInput = {
  token?: string;
};

export type RegisterSuccessData = {
  isNew: boolean;
  player: YouView;
  token: string;
  publicState: PublicState;
};

export type RegisterPlayerResult =
  | {
      ok: true;
      data: RegisterSuccessData;
    }
  | {
      ok: false;
      code: ErrorCode;
      message: string;
    };

export type VerifyTokenResult =
  | { ok: true; claims: PlayerTokenClaims }
  | { ok: false; code: ErrorCode; message: string };

export type Clock = {
  now(): number;
};
