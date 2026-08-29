import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Clock, Loader2, RefreshCw, Sparkles, Zap } from "lucide-react";
import { getApiUrl } from "../config/env.js";
import { useGameStore } from "../store/useGameStore.js";
import { useSessionStore } from "../store/useSessionStore.js";
import { useUiStore } from "../store/useUiStore.js";

interface JoinErrorState {
  code: string;
  title: string;
  description: string;
  badge: string;
  buttonText: string;
}

export function mapJoinError(code: string, status?: number): JoinErrorState {
  if (code === "GAME_NOT_FOUND" || status === 404) {
    return {
      code: "GAME_NOT_FOUND",
      title: "No Active Battle",
      description: "No battle is open right now. Please wait for the host.",
      badge: "STANDBY",
      buttonText: "Check Again",
    };
  }

  if (code === "JOIN_CLOSED") {
    return {
      code: "JOIN_CLOSED",
      title: "Registration Closed",
      description: "Registration for this battle is closed.",
      badge: "ROSTER LOCKED",
      buttonText: "Try Again",
    };
  }

  if (code === "SESSION_REPLACED") {
    return {
      code: "SESSION_REPLACED",
      title: "Session Expired",
      description: "This session belongs to another game.",
      badge: "EXPIRED",
      buttonText: "Join New Battle",
    };
  }

  if (code === "UNKNOWN_PLAYER") {
    return {
      code: "UNKNOWN_PLAYER",
      title: "Player Not Found",
      description: "Your player session is no longer valid. Please rejoin.",
      badge: "INVALID",
      buttonText: "Rejoin Battle",
    };
  }

  if (code === "UNAUTHORIZED" || status === 401) {
    return {
      code: "UNAUTHORIZED",
      title: "Authentication Failed",
      description: "Your player session could not be verified.",
      badge: "UNAUTHORIZED",
      buttonText: "Rejoin Battle",
    };
  }

  if ((status && status >= 500) || code === "SERVER_ERROR") {
    return {
      code: "SERVER_ERROR",
      title: "Server Unavailable",
      description: "The battle server is temporarily unavailable.",
      badge: "SERVER ERROR",
      buttonText: "Retry Connection",
    };
  }

  if (code === "MALFORMED_RESPONSE") {
    return {
      code: "MALFORMED_RESPONSE",
      title: "Protocol Error",
      description: "Received an invalid response from the battle server.",
      badge: "INVALID RESPONSE",
      buttonText: "Retry Connection",
    };
  }

  return {
    code: "NETWORK_ERROR",
    title: "Connection Failed",
    description: "Could not reach the battle server. Please check your connection.",
    badge: "OFFLINE",
    buttonText: "Retry Connection",
  };
}

export const JoinPage: React.FC = () => {
  const navigate = useNavigate();
  const { setPlayerSession, updateFromYou, clearSession } = useSessionStore();
  const { addToast } = useUiStore();
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>("CONNECTING TO BATTLE...");
  const [errorState, setErrorState] = useState<JoinErrorState | null>(null);

  const bootstrapPlayer = useCallback(async () => {
    setLoading(true);
    setErrorState(null);
    setStatusMessage("INITIALIZING BATTLE SESSION...");

    try {
      const apiUrl = getApiUrl("/api/player/register");

      const currentToken = useSessionStore.getState().token;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: currentToken ?? undefined }),
      });

      if (!response.ok) {
        let errCode = "UNKNOWN";
        try {
          const errData = await response.json();
          errCode = errData.code || String(response.status);
        } catch {
          errCode = String(response.status);
        }

        const mapped = mapJoinError(errCode, response.status);

        // If expired or unknown token, clear local token so next click registers fresh
        if (
          mapped.code === "SESSION_REPLACED" ||
          mapped.code === "UNKNOWN_PLAYER" ||
          mapped.code === "UNAUTHORIZED"
        ) {
          clearSession();
        }

        setErrorState(mapped);
        setLoading(false);
        return;
      }

      const result = await response.json();

      if (!result?.ok || !result?.data?.token || !result?.data?.player?.playerId || !result?.data?.player?.label) {
        const mapped = mapJoinError("MALFORMED_RESPONSE");
        setErrorState(mapped);
        setLoading(false);
        return;
      }

      const { token: playerToken, player, publicState } = result.data;

      // 1. Authoritative player session store
      setPlayerSession({
        token: playerToken,
        playerId: player.playerId,
        label: player.label,
      });

      // 2. Authoritative player view
      if (player) {
        updateFromYou(player);
      }

      // 3. Authoritative public state initialization
      if (publicState) {
        useGameStore.getState().applySync({ public: publicState });
      }

      setStatusMessage("SESSION READY — ENTERING ARENA...");

      setTimeout(() => {
        navigate("/game");
      }, 400);
    } catch {
      const mapped = mapJoinError("NETWORK_ERROR");
      setErrorState(mapped);
      setLoading(false);
      addToast({
        type: "error",
        title: "Connection Error",
        description: mapped.description,
      });
    }
  }, [clearSession, navigate, setPlayerSession, updateFromYou, addToast]);

  useEffect(() => {
    let isMounted = true;

    bootstrapPlayer().catch(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [bootstrapPlayer]);

  return (
    <div className="min-h-screen w-full bg-[#07090e] bg-cyber-grid flex flex-col items-center justify-center p-6 text-slate-100 relative overflow-hidden select-none">
      {/* Background Accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm z-10 flex flex-col items-center text-center space-y-8">
        {/* Logo Icon */}
        <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-cyan-500/40 flex items-center justify-center text-cyan-400 box-glow-cyan shadow-2xl">
          <Zap className="w-10 h-10 animate-pulse" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-950/40 text-cyan-300 text-xs font-mono-condensed tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            Orientation Battle 2026
          </div>
          <h1 className="text-4xl font-display uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-amber-400">
            Tug of War
          </h1>
          <p className="text-xs font-mono-condensed text-slate-400 tracking-wider">
            REAL-TIME MULTIPLAYER TEAM DUEL
          </p>
        </div>

        {/* Status / Error Box */}
        <div className="w-full p-6 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl flex flex-col items-center justify-center space-y-4 shadow-xl">
          {loading ? (
            <>
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <div className="text-xs font-mono-condensed text-slate-300 tracking-widest animate-pulse">
                {statusMessage}
              </div>
            </>
          ) : errorState ? (
            <div className="w-full flex flex-col items-center space-y-4 text-center">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-500/40 text-amber-300 text-[11px] font-mono-condensed uppercase tracking-wider font-bold">
                {errorState.code === "GAME_NOT_FOUND" ? (
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                )}
                {errorState.badge}
              </div>

              <div className="space-y-1">
                <div className="text-sm font-bold text-slate-100 font-display uppercase tracking-wide">
                  {errorState.title}
                </div>
                <div className="text-xs font-mono-condensed text-slate-400">
                  {errorState.description}
                </div>
              </div>

              <button
                onClick={() => bootstrapPlayer()}
                className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 font-display uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                {errorState.buttonText}
              </button>
            </div>
          ) : (
            <button
              onClick={() => bootstrapPlayer()}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 font-display uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              Enter Arena
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
