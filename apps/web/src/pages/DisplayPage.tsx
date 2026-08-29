import { useEffect, useRef, useState } from "react";
import { Monitor, Wifi, WifiOff, Lock, AlertTriangle } from "lucide-react";
import { socketClient } from "../socket/socketClient.js";
import { useSessionStore } from "../store/useSessionStore.js";
import { DisplayStage } from "../components/display/DisplayStage.js";

type DisplayAuthState =
  | "checking"    // Initial — checking for stored credential
  | "pin"         // Showing PIN input
  | "connecting"  // Connecting socket with supplied PIN
  | "connected"   // Socket authenticated and connected
  | "error";      // Auth or connection error

function mapErrorMessage(raw: string): string {
  if (raw.includes("UNAUTHORIZED") || raw.includes("Invalid display") || raw.includes("Invalid credentials")) {
    return "Display PIN rejected. Please try again.";
  }
  if (raw.includes("GAME_NOT_FOUND") || raw.includes("No active game")) {
    return "Waiting for the host to open a battle.";
  }
  if (raw.includes("ECONNREFUSED") || raw.includes("xhr poll error") || raw.includes("websocket error")) {
    return "Battle server unavailable — retrying...";
  }
  return "Connection lost — reconnecting...";
}

export const DisplayPage: React.FC = () => {
  const { displaySecret } = useSessionStore();
  const [authState, setAuthState] = useState<DisplayAuthState>("checking");
  const [pin, setPin] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const hasAttemptedAutoConnect = useRef(false);

  // On mount: if we have a stored credential, attempt auto-reconnect
  useEffect(() => {
    if (hasAttemptedAutoConnect.current) return;
    hasAttemptedAutoConnect.current = true;

    if (displaySecret) {
      setAuthState("connecting");
      socketClient.connectDisplay(displaySecret).then((result) => {
        if (result.ok) {
          setAuthState("connected");
        } else {
          // Stored credential is invalid — clear and show PIN screen
          useSessionStore.getState().setDisplaySecret(null);
          const friendly = mapErrorMessage(result.message ?? "");
          // Don't show "PIN rejected" for auto-reconnect — just go to PIN
          if (result.message?.includes("UNAUTHORIZED") || result.message?.includes("Invalid display")) {
            setErrorMsg("Stored PIN is no longer valid. Please re-enter.");
          } else {
            setErrorMsg(friendly);
          }
          setAuthState("pin");
        }
      });
    } else {
      setAuthState("pin");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus PIN input when shown
  useEffect(() => {
    if (authState === "pin" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [authState]);

  const handleConnect = async () => {
    const trimmed = pin.trim();
    if (!trimmed) {
      setErrorMsg("Please enter the display PIN.");
      return;
    }

    setAuthState("connecting");
    setErrorMsg("");

    const result = await socketClient.connectDisplay(trimmed);

    if (result.ok) {
      setAuthState("connected");
      setPin("");
    } else {
      const friendly = mapErrorMessage(result.message ?? "");
      setErrorMsg(friendly);
      setAuthState("error");
    }
  };

  const handleRetry = () => {
    setAuthState("pin");
    setErrorMsg("");
  };

  // ─── CONNECTED: show the projector stage ──────────────────────────────────
  if (authState === "connected") {
    return (
      <div className="w-screen h-screen overflow-hidden bg-[#07090e]">
        <DisplayStage />
      </div>
    );
  }

  // ─── CHECKING / CONNECTING: loading overlay ───────────────────────────────
  if (authState === "checking" || authState === "connecting") {
    return (
      <div className="w-screen h-screen bg-[#07090e] flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
            <Monitor className="w-8 h-8 text-cyan-400" />
          </div>
          <div className="absolute -inset-1 rounded-2xl border-2 border-cyan-500/30 animate-ping" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-slate-300 font-semibold text-lg tracking-wide">
            {authState === "checking" ? "Checking credentials..." : "Connecting display..."}
          </p>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── PIN SCREEN & ERROR SCREEN ────────────────────────────────────────────
  return (
    <div className="w-screen h-screen bg-[#07090e] flex flex-col items-center justify-center p-6">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-900/10 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] rounded-full bg-indigo-900/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-black/50">

          {/* Header */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                {authState === "error" ? (
                  <WifiOff className="w-7 h-7 text-red-400" />
                ) : (
                  <Monitor className="w-7 h-7 text-cyan-400" />
                )}
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                <Lock className="w-2.5 h-2.5 text-amber-400" />
              </div>
            </div>

            <div className="text-center">
              <h1 className="text-xl font-bold text-white tracking-tight">
                DISPLAY AUTHENTICATION
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                Operator access · Battle projector
              </p>
            </div>
          </div>

          {/* Error banner */}
          {errorMsg && (
            <div className="flex items-start gap-3 p-3.5 mb-6 rounded-xl bg-red-950/50 border border-red-800/50">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-red-300 text-sm leading-snug">{errorMsg}</p>
            </div>
          )}

          {/* PIN input */}
          <div className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="display-pin"
                className="block text-slate-400 text-xs font-semibold uppercase tracking-widest"
              >
                Enter Display PIN
              </label>
              <input
                id="display-pin"
                ref={inputRef}
                type="password"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (errorMsg) setErrorMsg("");
                  if (authState === "error") setAuthState("pin");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConnect();
                }}
                placeholder="••••••••••••"
                autoComplete="current-password"
                className="w-full px-4 py-3.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-600 font-mono text-base tracking-widest focus:outline-none focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 transition-all"
              />
            </div>

            <button
              id="display-connect-btn"
              onClick={handleConnect}
              disabled={!pin.trim()}
              className="w-full py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-900/40 active:scale-[0.98]"
            >
              <span className="flex items-center justify-center gap-2">
                <Wifi className="w-4 h-4" />
                CONNECT DISPLAY
              </span>
            </button>

            {authState === "error" && (
              <button
                id="display-retry-btn"
                onClick={handleRetry}
                className="w-full py-2.5 rounded-xl font-semibold text-xs uppercase tracking-widest text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 transition-all"
              >
                Try Again
              </button>
            )}
          </div>

          {/* Footer note */}
          <p className="text-slate-700 text-xs text-center mt-6">
            This display is intended for operator use only
          </p>
        </div>
      </div>
    </div>
  );
};
