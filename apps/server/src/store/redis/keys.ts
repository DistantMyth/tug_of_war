export const KEY_PREFIX = "tow:";

export const RedisKeys = {
  currentEvent: () => "tow:event:current",
  game: (gameId: string) => `tow:game:${gameId}`,
  players: (gameId: string) => `tow:game:${gameId}:players`,
  teamLeft: (gameId: string) => `tow:game:${gameId}:team:left`,
  teamRight: (gameId: string) => `tow:game:${gameId}:team:right`,
  teamWild: (gameId: string) => `tow:game:${gameId}:team:wild`,
  online: (gameId: string) => `tow:game:${gameId}:online`,
  scoreLeft: (gameId: string) => `tow:game:${gameId}:score:left`,
  scoreRight: (gameId: string) => `tow:game:${gameId}:score:right`,
  plan: (gameId: string) => `tow:game:${gameId}:plan`,
  planMoves: (gameId: string) => `tow:game:${gameId}:plan:moves`,
  playerSeq: (gameId: string) => `tow:game:${gameId}:seq:player`,
  rateLimitTap: (playerId: string) => `tow:rl:tap:${playerId}`,
} as const;
