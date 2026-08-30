import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Clock, Loader2, RefreshCw, Sparkles, Swords, Zap, Shield, Flame } from "lucide-react";
import { getApiUrl } from "../config/env.js";
import { useGameStore } from "../store/useGameStore.js";
import { useSessionStore } from "../store/useSessionStore.js";
import { useUiStore } from "../store/useUiStore.js";
import { ParticleBackground } from "../components/common/ParticleBackground.js";
import { CyberTitanCrest, SolarPhoenixCrest } from "../components/common/TeamBadges.js";

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
    <div className="min-h-screen w-full bg-[#050811] bg-arena-stadium flex flex-col items-center justify-center p-6 text-slate-100 relative overflow-hidden select-none">
      {/* Dynamic Ambient Particle Fog */}
      <ParticleBackground mode="ambient" intensity="low" />

      {/* Radiant Glow Lights */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm z-10 flex flex-col items-center text-center space-y-6">
        {/* Dual Mascot Crest Hero Banner */}
        <div className="flex items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border-2 border-cyan-500/50 flex items-center justify-center box-glow-cyan">
            <CyberTitanCrest size={40} />
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-400">
            <Swords className="w-5 h-5 animate-pulse" />
          </div>
          <div className="w-16 h-16 rounded-2xl bg-amber-950/60 border-2 border-amber-500/50 flex items-center justify-center box-glow-amber">
            <SolarPhoenixCrest size={40} />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-cyan-500/40 bg-cyan-950/60 text-cyan-300 text-xs font-mono-condensed tracking-widest uppercase shadow-lg shadow-cyan-950/50">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Orientation Battle 2026</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-amber-400 drop-shadow-[0_0_25px_rgba(0,240,255,0.4)]">
            Tug of War
          </h1>
          <p className="text-xs font-mono-condensed text-slate-300 tracking-wider flex items-center justify-center gap-2">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            REAL-TIME MULTIPLAYER ARENA DUEL
            <Flame className="w-3.5 h-3.5 text-amber-400" />
          </p>
        </div>

        {/* Status / Error Box */}
        <div className="w-full p-6 rounded-3xl bg-slate-900/90 border-2 border-slate-800/80 backdrop-blur-2xl flex flex-col items-center justify-center space-y-4 shadow-2xl shadow-black/80">
          {loading ? (
            <>
              <div className="relative">
                <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                <div className="absolute inset-0 rounded-full border border-cyan-400/40 animate-ping" />
              </div>
              <div className="text-xs font-mono-condensed text-slate-200 tracking-widest animate-pulse font-bold">
                {statusMessage}
              </div>
            </>
          ) : errorState ? (
            <div className="w-full flex flex-col items-center space-y-4 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-950/70 border border-amber-500/50 text-amber-300 text-xs font-mono-condensed uppercase tracking-wider font-bold">
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
                <div className="text-xs font-mono-condensed text-slate-300">
                  {errorState.description}
                </div>
              </div>

              <button
                onClick={() => bootstrapPlayer()}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 font-display uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/60 transition-all active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                {errorState.buttonText}
              </button>
            </div>
          ) : (
            <button
              onClick={() => bootstrapPlayer()}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-400 to-cyan-300 hover:from-cyan-400 hover:to-cyan-200 text-slate-950 font-display text-lg uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/60 transition-all active:scale-[0.98]"
            >
              Enter Arena
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Feature Badges Footer */}
        <div className="flex items-center justify-center gap-4 text-[11px] font-mono-condensed text-slate-400">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-cyan-400" /> Instant Sync
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Ultra Low-Latency
          </span>
        </div>
      </div>
    </div>
  );
};
