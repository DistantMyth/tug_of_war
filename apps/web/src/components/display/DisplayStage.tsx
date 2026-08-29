import { useEffect, useState } from "react";
import { Maximize2, Minimize2, Volume2, VolumeX } from "lucide-react";
import { useDisplayConnectionStore } from "../../store/useDisplayConnectionStore.js";
import { useGameStore } from "../../store/useGameStore.js";
import { useUiStore } from "../../store/useUiStore.js";
import { BattleScene } from "./BattleScene.js";
import { CountdownScene } from "./CountdownScene.js";
import { ResultsScene } from "./ResultsScene.js";
import { TeamBalanceScene } from "./TeamBalanceScene.js";
import { WelcomeScene } from "./WelcomeScene.js";

interface DisplayStageProps {
  isPreview?: boolean;
}

export const DisplayStage: React.FC<DisplayStageProps> = ({ isPreview = false }) => {
  const { phase } = useGameStore();
  // Display status comes from the DISPLAY-specific store, not the shared player/admin store.
  const { status: displayStatus } = useDisplayConnectionStore();
  const { soundEnabled, toggleSound } = useUiStore();
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Derive dot color and label from display-specific status
  const statusDotClass =
    displayStatus === "connected"
      ? "bg-emerald-400 animate-pulse"
      : displayStatus === "connecting"
        ? "bg-amber-400 animate-pulse"
        : "bg-red-400";

  const statusLabel = displayStatus.toUpperCase();

  useEffect(() => {
    // Display socket is established by DisplayPage before this component renders.
    // When isPreview=true (admin panel), no socket connection is needed at all.
  }, [isPreview]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const renderScene = () => {
    switch (phase) {
      case "OPEN":
      case "WAITING":
        return <WelcomeScene />;
      case "BALANCING":
      case "LOCKING":
        return <TeamBalanceScene />;
      case "COUNTDOWN":
        return <CountdownScene />;
      case "RUNNING":
      case "PAUSED":
        return <BattleScene />;
      case "FINISHED":
      case "RESULTS":
        return <ResultsScene />;
      default:
        return <WelcomeScene />;
    }
  };

  return (
    <div className={`relative w-full h-full bg-[#07090e] overflow-hidden select-none ${isPreview ? "rounded-2xl" : ""}`}>
      {/* Top Floating Controls (Hidden if preview) */}
      {!isPreview && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
          {/* Connection Status Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-mono-condensed backdrop-blur-md">
            <div
              className={`w-2 h-2 rounded-full ${statusDotClass}`}
            />
            <span className="text-slate-400 uppercase">{statusLabel}</span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="p-2 rounded-full bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-slate-100 hover:border-slate-700 backdrop-blur-md transition-colors"
            title={soundEnabled ? "Mute Audio" : "Unmute Audio"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-slate-100 hover:border-slate-700 backdrop-blur-md transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Render Active Stage Scene */}
      {renderScene()}
    </div>
  );
};
