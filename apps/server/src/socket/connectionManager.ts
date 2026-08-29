export class GameConnectionManager {
  private readonly playerToActiveSocket = new Map<string, string>(); // playerId -> socketId
  private readonly socketToPlayer = new Map<string, string>(); // socketId -> playerId
  private totalConnections = 0;

  incrementConnections(): void {
    this.totalConnections += 1;
  }

  decrementConnections(): void {
    this.totalConnections = Math.max(0, this.totalConnections - 1);
  }

  getConnectionCount(): number {
    return this.totalConnections;
  }

  setActiveSocket(playerId: string, socketId: string): string | null {
    const previousSocketId = this.playerToActiveSocket.get(playerId) ?? null;
    this.playerToActiveSocket.set(playerId, socketId);
    this.socketToPlayer.set(socketId, playerId);
    return previousSocketId && previousSocketId !== socketId ? previousSocketId : null;
  }

  isActiveSocket(playerId: string, socketId: string): boolean {
    return this.playerToActiveSocket.get(playerId) === socketId;
  }

  getActiveSocket(playerId: string): string | null {
    return this.playerToActiveSocket.get(playerId) ?? null;
  }

  removeSocket(socketId: string): { playerId: string | null; wasActive: boolean } {
    const playerId = this.socketToPlayer.get(socketId) ?? null;
    this.socketToPlayer.delete(socketId);

    if (playerId) {
      const activeId = this.playerToActiveSocket.get(playerId);
      if (activeId === socketId) {
        this.playerToActiveSocket.delete(playerId);
        return { playerId, wasActive: true };
      }
      return { playerId, wasActive: false };
    }

    return { playerId: null, wasActive: false };
  }

  clear(): void {
    this.playerToActiveSocket.clear();
    this.socketToPlayer.clear();
    this.totalConnections = 0;
  }
}
