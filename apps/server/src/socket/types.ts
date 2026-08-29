import type {
  Ack,
  AdminAutoBalancePayload,
  AdminConfirmPayload,
  AdminExtendPayload,
  AdminOpenPayload,
  AdminSetWildcardPayload,
  ChooseTeamPayload,
  ErrorCode,
  GameCounts,
  PlayerHelloPayload,
  PublicState,
  RequestSyncPayload,
  SwitchTeamPayload,
  TapPayload,
  YouView,
} from "@tow/shared";
import type { Socket, Server, Namespace } from "socket.io";
import type { StoredPlayer } from "../store/redis/types.js";

export type SocketRole = "player" | "display" | "admin";

export type PlayerSocketData = {
  role: "player";
  gameId: string;
  playerId: string;
  player: StoredPlayer;
  token?: string;
  isActive: boolean;
};

export type DisplaySocketData = {
  role: "display";
  gameId: string;
};

export type AdminSocketData = {
  role: "admin";
  gameId: string;
  authenticatedAt: number;
};

export type GameSocketData = PlayerSocketData | DisplaySocketData | AdminSocketData;

export type ClientToServerEvents = {
  "player:hello": (
    payload: PlayerHelloPayload,
    callback?: (ack: Ack<{ public: PublicState; you: YouView }>) => void,
  ) => void;
  "player:choose_team": (
    payload: ChooseTeamPayload,
    callback?: (ack: Ack<{ team: "left" | "right"; counts: GameCounts }>) => void,
  ) => void;
  "player:switch_team": (
    payload: SwitchTeamPayload,
    callback?: (ack: Ack<{ team: "left" | "right"; counts: GameCounts }>) => void,
  ) => void;
  "player:request_sync": (
    payload: RequestSyncPayload,
    callback?: (ack: Ack<{ public: PublicState; you?: YouView }>) => void,
  ) => void;
  "player:tap": (payload: TapPayload, callback?: (ack: Ack) => void) => void;
};

export type ServerToClientEvents = {
  sync: (data: { public: PublicState; you?: YouView }) => void;
  "game:counts": (counts: GameCounts) => void;
  "game:phase": (data: { phase: string; at: number }) => void;
  "player:you": (you: YouView) => void;
  "player:replaced": (data: { message: string }) => void;
  error: (err: { code: ErrorCode; message: string }) => void;
};

export type InterServerEvents = Record<string, never>;

export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, GameSocketData>;
export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, GameSocketData>;
export type GameNamespace = Namespace<ClientToServerEvents, ServerToClientEvents, InterServerEvents, GameSocketData>;
