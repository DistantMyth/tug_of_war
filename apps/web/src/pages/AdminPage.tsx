import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Clock,
  FastForward,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Square,
  Users,
  Wifi,
  Zap,
} from "lucide-react";
import { DisplayStage } from "../components/display/DisplayStage.js";
import { CyberTitanCrest, SolarPhoenixCrest, ChaosWildcardCrest } from "../components/common/TeamBadges.js";
import { socketClient } from "../socket/socketClient.js";
import { useConnectionStore } from "../store/useConnectionStore.js";
import { useGameStore } from "../store/useGameStore.js";
import { useSessionStore } from "../store/useSessionStore.js";
import { useUiStore } from "../store/useUiStore.js";

export const AdminPage: React.FC = () => {
  const { adminToken, setAdminToken } = useSessionStore();
  const { status } = useConnectionStore();
  const { phase, counts, scores, roundNumber, balancePlan } = useGameStore();
  const { addToast } = useUiStore();

  const [passwordInput, setPasswordInput] = useState<string>("");
  const [authStatus, setAuthStatus] = useState<"idle" | "authenticating" | "authenticated" | "error">("idle");
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

  const hasAttemptedAutoConnect = useRef(false);

  useEffect(() => {
    if (hasAttemptedAutoConnect.current) return;
    hasAttemptedAutoConnect.current = true;

    if (adminToken && adminToken.trim().length > 0) {
      setAuthStatus("authenticating");
      socketClient.connectAdmin(adminToken.trim()).then((res) => {
        if (res.ok) {
          setAuthStatus("authenticated");
          setAuthError(null);
        } else {
          setAuthStatus("error");
          setAuthError(res.message ?? "Authentication failed");
        }
      });
    } else {
      setAuthStatus("idle");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const candidate = passwordInput.trim();
    if (!candidate) return;

    setAuthStatus("authenticating");
    setAuthError(null);

    const res = await socketClient.connectAdmin(candidate);
    if (res.ok) {
      setAdminToken(candidate);
      setAuthStatus("authenticated");
      addToast({
        type: "success",
        title: "Admin Authenticated",
        description: "Authenticated with battle control server",
      });
    } else {
      setAuthStatus("error");
      setAuthError(res.message ?? "Invalid admin credentials");
      addToast({
        type: "error",
        title: "Admin Authentication Failed",
        description: res.message ?? "Invalid admin credentials",
      });
    }
  };

  const isAuthenticated = authStatus === "authenticated" && status === "connected";

  const executeAdminAction = async (name: string, actionFn: () => Promise<any>) => {
    if (!isAuthenticated) {
      addToast({
        type: "error",
        title: "Unauthorized",
        description: "Must authenticate as admin before executing commands",
      });
      return;
    }
    setLoadingAction(name);
    try {
      const res = await actionFn();
      if (res && !res.ok) {
        addToast({
          type: "error",
          title: `${name} Failed`,
          description: res.message || "Action rejected by server",
        });
      } else {
        addToast({ type: "success", title: "Success", description: `${name} executed successfully` });
      }
    } catch (err) {
      addToast({ type: "error", title: "Error", description: String(err) });
    } finally {
      setLoadingAction(null);
      setConfirmModal(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] bg-cyber-grid text-slate-100 p-4 md:p-8 flex flex-col gap-6 select-none">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-display uppercase tracking-wider text-slate-100">
              Battle Control Panel
            </h1>
            <div className="text-xs font-mono-condensed text-slate-400">
              STAGE STATUS: <span className="text-cyan-400 font-bold uppercase">{phase}</span> • ROUND {roundNumber}
            </div>
          </div>
        </div>

        {/* Admin Token Auth / Connection Pill */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status Badge */}
          {authStatus === "authenticated" && status === "connected" && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-mono-condensed font-bold">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>ADMIN AUTHENTICATED</span>
            </div>
          )}

          {authStatus === "authenticating" && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-mono-condensed font-bold">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>AUTHENTICATING ADMIN...</span>
            </div>
          )}

          {(authStatus === "error" || (authStatus === "authenticated" && status !== "connected")) && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-950/60 border border-red-500/40 text-red-400 text-xs font-mono-condensed font-bold">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <span>{authError ? `AUTH FAILED: ${authError}` : "DISCONNECTED"}</span>
            </div>
          )}

          {authStatus === "idle" && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-slate-400 text-xs font-mono-condensed">
              <div className="w-2 h-2 rounded-full bg-slate-500" />
              <span>UNAUTHENTICATED</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex items-center gap-2">
            <input
              type="password"
              placeholder="Admin Password (default: admin)"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono-condensed text-slate-200 focus:outline-none focus:border-cyan-500 min-w-[220px]"
            />
            <button
              type="submit"
              disabled={authStatus === "authenticating"}
              className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono-condensed transition-colors"
            >
              {authStatus === "authenticating" ? "Verifying..." : "Auth"}
            </button>
          </form>
        </div>
      </div>

      {/* Main Grid: Left = Live Projector Preview, Right = Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Projector Preview (16:9) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="text-xs font-mono-condensed text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Wifi className="w-4 h-4 text-cyan-400" />
            Live Projector Broadcast View (Mirrors Audience Display)
          </div>

          <div className="relative w-full aspect-video rounded-2xl border-2 border-slate-800 overflow-hidden shadow-2xl bg-black">
            <DisplayStage isPreview={true} />
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md">
              <div className="text-[10px] font-mono-condensed text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Total Warriors</span>
              </div>
              <div className="text-2xl font-mono-condensed font-black text-slate-100 mt-1">
                {counts.total} <span className="text-xs text-emerald-400 font-normal">({counts.online} online)</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-slate-900/90 border-2 border-cyan-500/40 box-glow-cyan">
              <div className="text-[10px] font-mono-condensed text-cyan-400 uppercase tracking-wider flex items-center justify-between">
                <span>Team Cyan</span>
                <CyberTitanCrest size={20} />
              </div>
              <div className="text-2xl font-mono-condensed font-black text-slate-100 mt-1">
                {counts.left} <span className="text-xs text-cyan-400 font-normal">({scores.left.toLocaleString()} taps)</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/40 to-slate-900/90 border-2 border-amber-500/40 box-glow-amber">
              <div className="text-[10px] font-mono-condensed text-amber-400 uppercase tracking-wider flex items-center justify-between">
                <span>Team Amber</span>
                <SolarPhoenixCrest size={20} />
              </div>
              <div className="text-2xl font-mono-condensed font-black text-slate-100 mt-1">
                {counts.right} <span className="text-xs text-amber-400 font-normal">({scores.right.toLocaleString()} taps)</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/40 to-slate-900/90 border-2 border-purple-500/40 box-glow-violet">
              <div className="text-[10px] font-mono-condensed text-purple-400 uppercase tracking-wider flex items-center justify-between">
                <span>Chaos Hero</span>
                <ChaosWildcardCrest size={20} />
              </div>
              <div className="text-2xl font-mono-condensed font-black text-slate-100 mt-1">
                {counts.chaos}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Stage Command Controls */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {!isAuthenticated && (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-mono-condensed flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400" />
              <span>ADMIN AUTHENTICATION REQUIRED — Enter the admin secret above and click Auth to enable battle controls.</span>
            </div>
          )}

          {/* Group 1: Session & Lobby */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-lg">
            <div className="text-xs font-mono-condensed text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4" />
              1. Lobby & Roster Controls
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={!isAuthenticated || loadingAction !== null}
                onClick={() => executeAdminAction("Open Game Session", () => socketClient.adminOpen(30000))}
                className="py-3 px-4 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-mono-condensed font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              >
                <Zap className="w-4 h-4" />
                Open / Reset Lobby
              </button>

              <button
                disabled={!isAuthenticated || loadingAction !== null || phase !== "OPEN"}
                onClick={() => executeAdminAction("Lock Roster", () => socketClient.adminLock())}
                className="py-3 px-4 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-mono-condensed font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              >
                <Lock className="w-4 h-4" />
                Lock Roster
              </button>
            </div>
          </div>

          {/* Group 2: Balancing Controls */}
          {(phase === "BALANCING" || phase === "LOCKING") && (
            <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-3 shadow-lg box-glow-amber">
              <div className="text-xs font-mono-condensed text-amber-400 font-bold uppercase tracking-wider flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" />
                2. Team Balancing Required ({balancePlan?.remainingLeftToRight ?? 0} L→R, {balancePlan?.remainingRightToLeft ?? 0} R→L)
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={!isAuthenticated || loadingAction !== null}
                  onClick={() => executeAdminAction("Auto-Balance Preview", () => socketClient.adminAutoBalance(true, false))}
                  className="py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono-condensed uppercase tracking-wider disabled:opacity-40"
                >
                  Preview Auto-Balance
                </button>

                <button
                  disabled={!isAuthenticated || loadingAction !== null}
                  onClick={() => executeAdminAction("Confirm Auto-Balance", () => socketClient.adminAutoBalance(false, true))}
                  className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono-condensed font-bold uppercase tracking-wider shadow-md disabled:opacity-40"
                >
                  Confirm & Launch ⚡
                </button>
              </div>

              <button
                disabled={!isAuthenticated || loadingAction !== null}
                onClick={() =>
                  setConfirmModal({
                    title: "Cancel Balancing?",
                    description: "This will unlock the lobby and return to OPEN phase for participants to choose teams again.",
                    action: async () => executeAdminAction("Cancel Balancing", () => socketClient.adminCancelBalance()),
                  })
                }
                className="w-full py-2 px-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-red-500/40 text-red-400 text-xs font-mono-condensed uppercase tracking-wider transition-colors disabled:opacity-40"
              >
                Cancel Balancing (Revert to Open)
              </button>
            </div>
          )}

          {/* Group 3: Live Gameplay Controls */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-lg">
            <div className="text-xs font-mono-condensed text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4" />
              3. Live Match Operations
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                disabled={!isAuthenticated || loadingAction !== null || (phase !== "RUNNING" && phase !== "COUNTDOWN")}
                onClick={() => executeAdminAction("Pause Game", () => socketClient.adminPause())}
                className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-mono-condensed font-bold uppercase flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>

              <button
                disabled={!isAuthenticated || loadingAction !== null || phase !== "PAUSED"}
                onClick={() => executeAdminAction("Resume Game", () => socketClient.adminResume())}
                className="py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-mono-condensed font-bold uppercase flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Play className="w-4 h-4" />
                Resume
              </button>

              <button
                disabled={!isAuthenticated || loadingAction !== null || (phase !== "RUNNING" && phase !== "PAUSED")}
                onClick={() =>
                  setConfirmModal({
                    title: "End Match Now?",
                    description: "This will terminate the round immediately and announce the authoritative winner.",
                    action: async () => executeAdminAction("End Round", () => socketClient.adminEndRound()),
                  })
                }
                className="py-3 px-3 rounded-xl bg-red-950/50 hover:bg-red-900/50 border border-red-500/40 text-red-300 text-xs font-mono-condensed font-bold uppercase flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Square className="w-4 h-4" />
                End Round
              </button>
            </div>

            {/* Time Extensions */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <div className="text-[10px] font-mono-condensed text-slate-400 uppercase">Extend Round Time</div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  disabled={!isAuthenticated || loadingAction !== null || phase !== "RUNNING"}
                  onClick={() => executeAdminAction("Extend +5s", () => socketClient.adminExtend(5))}
                  className="py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-xs font-mono-condensed text-cyan-300 border border-slate-700 disabled:opacity-40"
                >
                  +5 Seconds
                </button>
                <button
                  disabled={!isAuthenticated || loadingAction !== null || phase !== "RUNNING"}
                  onClick={() => executeAdminAction("Extend +10s", () => socketClient.adminExtend(10))}
                  className="py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-xs font-mono-condensed text-cyan-300 border border-slate-700 disabled:opacity-40"
                >
                  +10 Seconds
                </button>
                <button
                  disabled={!isAuthenticated || loadingAction !== null || phase !== "RUNNING"}
                  onClick={() => executeAdminAction("Extend +15s", () => socketClient.adminExtend(15))}
                  className="py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-xs font-mono-condensed text-cyan-300 border border-slate-700 disabled:opacity-40"
                >
                  +15 Seconds
                </button>
              </div>
            </div>
          </div>

          {/* Group 4: Next Round / Rematch */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-lg">
            <div className="text-xs font-mono-condensed text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              4. Rematch & Next Round
            </div>

            <button
              disabled={!isAuthenticated || loadingAction !== null || (phase !== "FINISHED" && phase !== "RESULTS")}
              onClick={() => executeAdminAction("Next Round (Keep Teams)", () => socketClient.adminPlayAgain(30000))}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 text-xs font-mono-condensed font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg"
            >
              <FastForward className="w-4 h-4" />
              Play Next Round (Same Teams)
            </button>
          </div>
        </div>
      </div>

      {/* Safety Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-display uppercase tracking-wider text-slate-100">{confirmModal.title}</h3>
            </div>
            <p className="text-xs font-mono-condensed text-slate-300 leading-relaxed">
              {confirmModal.description}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono-condensed uppercase tracking-wider text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.action}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-mono-condensed uppercase font-bold tracking-wider text-slate-100 shadow-md"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
