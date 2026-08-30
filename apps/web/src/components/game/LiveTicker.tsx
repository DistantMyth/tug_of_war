import React, { useMemo } from "react";
import {
  Flame,
  Zap,
  Clock,
  Trophy,
  Swords,
  Sparkles,
  AlertTriangle,
  Radio,
  TrendingUp,
} from "lucide-react";
import { useGameStore } from "../../store/useGameStore.js";

export interface LiveTickerProps {
  className?: string;
  customMessages?: string[];
  speed?: "normal" | "fast" | "slow";
}

interface TickerItem {
  id: string;
  type: "cyan" | "amber" | "urgent" | "gold" | "neutral" | "chaos";
  icon: React.ReactNode;
  tag: string;
  text: string;
}

export const LiveTicker: React.FC<LiveTickerProps> = ({
  className = "",
  customMessages,
  speed = "normal",
}) => {
  const { scores, counts, timing, phase, winner, wildcard, extensionBanner } = useGameStore();

  const totalScore = scores.left + scores.right;
  const scoreDiff = Math.abs(scores.left - scores.right);
  const leftLeading = scores.left > scores.right;
  const rightLeading = scores.right > scores.left;
  const isTied = scores.left === scores.right;

  // Derive remaining seconds for dynamic announcements
  const now = Date.now();
  const endTime = timing.endTime ?? now + 30000;
  const remainingSec = Math.max(0, Math.floor((endTime - now) / 1000));
  const isLast5Sec = remainingSec <= 5 && remainingSec > 0 && phase === "RUNNING";

  const tickerItems: TickerItem[] = useMemo(() => {
    if (customMessages && customMessages.length > 0) {
      return customMessages.map((msg, i) => ({
        id: `custom-${i}`,
        type: "neutral",
        icon: <Zap className="w-4 h-4 text-cyan-400" />,
        tag: "BROADCAST",
        text: msg,
      }));
    }

    const items: TickerItem[] = [];

    // Phase-specific announcements
    if (phase === "COUNTDOWN") {
      items.push({
        id: "cd-1",
        type: "urgent",
        icon: <Clock className="w-4 h-4 text-amber-400 animate-spin" />,
        tag: "COUNTDOWN",
        text: "⚡ ALL PLAYERS TO BATTLE STATIONS • COUNTDOWN IN PROGRESS • READY YOUR TAPS!",
      });
      items.push({
        id: "cd-2",
        type: "cyan",
        icon: <Zap className="w-4 h-4 text-cyan-400" />,
        tag: "TEAM CYAN",
        text: "CYBER TITANS POWERING UP RESONANCE CORES!",
      });
      items.push({
        id: "cd-3",
        type: "amber",
        icon: <Flame className="w-4 h-4 text-amber-400" />,
        tag: "TEAM AMBER",
        text: "SOLAR PHOENIX IGNITING SOLAR COMBUSTION ENGINES!",
      });
      return items;
    }

    if (phase === "BALANCING" || phase === "LOCKING") {
      items.push({
        id: "bal-1",
        type: "gold",
        icon: <Swords className="w-4 h-4 text-amber-400" />,
        tag: "FAIR PLAY",
        text: "⚖️ MATCH ROSTER BALANCING • VOLUNTEERS STAND BY • PREPARE FOR ARENA COMMENCEMENT",
      });
      if (wildcard) {
        items.push({
          id: "bal-2",
          type: "chaos",
          icon: <Sparkles className="w-4 h-4 text-fuchsia-400" />,
          tag: "CHAOS WILDCARD",
          text: `🌌 CHAOS OPERATIVE ASSIGNED: ${wildcard.label.toUpperCase()} WILL SHIFT THE TIDES!`,
        });
      }
      return items;
    }

    if (phase === "OPEN" || phase === "WAITING") {
      items.push({
        id: "open-1",
        type: "neutral",
        icon: <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />,
        tag: "LOBBY OPEN",
        text: "🎮 ARENA LOBBY OPEN • SCAN QR CODE TO ENLIST • CHOOSE YOUR FACTION",
      });
      items.push({
        id: "open-2",
        type: "cyan",
        icon: <Zap className="w-4 h-4 text-cyan-400" />,
        tag: "ENLIST",
        text: `CYBER TITANS: ${counts.left} WARRIORS READY FOR DEPLOYMENT`,
      });
      items.push({
        id: "open-3",
        type: "amber",
        icon: <Flame className="w-4 h-4 text-amber-400" />,
        tag: "ENLIST",
        text: `SOLAR PHOENIX: ${counts.right} WARRIORS READY FOR DEPLOYMENT`,
      });
      return items;
    }

    if (phase === "FINISHED" || phase === "RESULTS") {
      if (winner === "left") {
        items.push({
          id: "win-1",
          type: "cyan",
          icon: <Trophy className="w-4 h-4 text-cyan-300" />,
          tag: "VICTORY",
          text: `🏆 CYBER TITANS CLAIM SUPREME DOMINANCE! +${scoreDiff.toLocaleString()} TAP MARGIN!`,
        });
        items.push({
          id: "win-2",
          type: "gold",
          icon: <Sparkles className="w-4 h-4 text-amber-300" />,
          tag: "CHAMPIONS",
          text: "⚡ RECORD-BREAKING PULL VELOCITY IN ARENA COLOSSEUM!",
        });
      } else if (winner === "right") {
        items.push({
          id: "win-1",
          type: "amber",
          icon: <Trophy className="w-4 h-4 text-amber-300" />,
          tag: "VICTORY",
          text: `🏆 SOLAR PHOENIX IGNITES THE ARENA! +${scoreDiff.toLocaleString()} TAP MARGIN!`,
        });
        items.push({
          id: "win-2",
          type: "gold",
          icon: <Flame className="w-4 h-4 text-amber-400" />,
          tag: "CHAMPIONS",
          text: "🔥 GLORIOUS TRIUMPH WITH RELENTLESS SOLAR FORCE!",
        });
      } else {
        items.push({
          id: "win-draw",
          type: "gold",
          icon: <Swords className="w-4 h-4 text-purple-300" />,
          tag: "DEADLOCK",
          text: "⚔️ DEADLOCK DETECTED! AN UNPRECEDENTED HISTORIC DRAW IN THE ARENA!",
        });
      }
      return items;
    }

    // Phase: RUNNING / PAUSED
    if (phase === "PAUSED") {
      items.push({
        id: "paused-1",
        type: "urgent",
        icon: <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />,
        tag: "PAUSED",
        text: "⏸️ ARENA PAUSED BY OFFICIALS • HOLD POSITIONS • STAND BY FOR RESUME",
      });
      return items;
    }

    // Overtime / Extension Alert
    if (extensionBanner && Date.now() - extensionBanner.at < 6000) {
      items.push({
        id: "ext-1",
        type: "urgent",
        icon: <AlertTriangle className="w-4 h-4 text-emerald-400 animate-bounce" />,
        tag: "OVERTIME",
        text: `🚨 +${extensionBanner.seconds} SECONDS ADDED! SUDDEN DEATH OVERDRIVE ACTIVATED!`,
      });
    }

    // Final 5 Seconds Alert
    if (isLast5Sec) {
      items.push({
        id: "last-5",
        type: "urgent",
        icon: <Clock className="w-4 h-4 text-red-400 animate-ping" />,
        tag: "CRITICAL",
        text: "⏳ FINAL 5 SECONDS — ALL-OUT OVERDRIVE! MAXIMUM VELOCITY!",
      });
      items.push({
        id: "last-5-action",
        type: "gold",
        icon: <Zap className="w-4 h-4 text-yellow-300" />,
        tag: "OVERCLOCK",
        text: "⚡ MASH EVERY TAP! EVERY MILLISECOND COUNTS FOR ARENA GLORY!",
      });
    }

    // Dynamic Live Match Commentary based on score differential
    if (leftLeading && scoreDiff >= 100) {
      items.push({
        id: "lead-cyan-heavy",
        type: "cyan",
        icon: <Zap className="w-4 h-4 text-cyan-400" />,
        tag: "CYAN SURGE",
        text: `⚡ TEAM CYAN LAUNCHES A MAJOR SURGE! (+${scoreDiff.toLocaleString()} TAPS DOMINANCE)`,
      });
      items.push({
        id: "resp-amber",
        type: "amber",
        icon: <TrendingUp className="w-4 h-4 text-amber-400" />,
        tag: "AMBER DEFENSE",
        text: "🔥 TEAM AMBER COUNTER-ATTACKING! DIGGING IN WITH REAR ANCHOR FORCE!",
      });
    } else if (rightLeading && scoreDiff >= 100) {
      items.push({
        id: "lead-amber-heavy",
        type: "amber",
        icon: <Flame className="w-4 h-4 text-amber-400" />,
        tag: "AMBER SURGE",
        text: `🔥 TEAM AMBER LAUNCHES A MAJOR SURGE! (+${scoreDiff.toLocaleString()} TAPS DOMINANCE)`,
      });
      items.push({
        id: "resp-cyan",
        type: "cyan",
        icon: <TrendingUp className="w-4 h-4 text-cyan-400" />,
        tag: "CYAN DEFENSE",
        text: "⚡ TEAM CYAN COUNTER-ATTACKING! FIRING HYPER VOLTAGE PULLS!",
      });
    } else if (leftLeading && scoreDiff >= 20) {
      items.push({
        id: "lead-cyan-light",
        type: "cyan",
        icon: <Zap className="w-4 h-4 text-cyan-400" />,
        tag: "MOMENTUM",
        text: "⚡ TEAM CYAN GAINING CRITICAL TRACTION! CABLE SHIFTING WEST!",
      });
      items.push({
        id: "resp-amber-light",
        type: "amber",
        icon: <Flame className="w-4 h-4 text-amber-400" />,
        tag: "COUNTER",
        text: "🔥 TEAM AMBER RETALIATING WITH SYNCHRONIZED BURSTS!",
      });
    } else if (rightLeading && scoreDiff > 20) {
      items.push({
        id: "lead-amber-light",
        type: "amber",
        icon: <Flame className="w-4 h-4 text-amber-400" />,
        tag: "MOMENTUM",
        text: "🔥 TEAM AMBER GAINING CRITICAL TRACTION! CABLE SHIFTING EAST!",
      });
      items.push({
        id: "resp-cyan-light",
        type: "cyan",
        icon: <Zap className="w-4 h-4 text-cyan-400" />,
        tag: "COUNTER",
        text: "⚡ TEAM CYAN FIGHTING BACK WITH OVERWHELMING FORCE!",
      });
    } else if (isTied || scoreDiff <= 20) {
      items.push({
        id: "deadlock-1",
        type: "gold",
        icon: <Swords className="w-4 h-4 text-yellow-400" />,
        tag: "DEADLOCK",
        text: "⚔️ DEAD-HEAT CLASH! BOTH TEAMS LOCKED IN A TITANIC DEADLOCK!",
      });
      items.push({
        id: "tension-max",
        type: "urgent",
        icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
        tag: "MAX TENSION",
        text: "💥 BRAIDED STEEL CABLE UNDER MAXIMUM TENSION • CROWD IS ROARING!",
      });
    }

    // Always include atmospheric stadium telemetry items
    items.push({
      id: "stats-1",
      type: "neutral",
      icon: <Radio className="w-4 h-4 text-sky-400 animate-pulse" />,
      tag: "TELEMETRY",
      text: `TOTAL TAPS REGISTERED: ${totalScore.toLocaleString()} • COMBINED INGESTION ACTIVE`,
    });
    items.push({
      id: "action-flanks",
      type: "gold",
      icon: <Sparkles className="w-4 h-4 text-amber-300" />,
      tag: "ESPORTS",
      text: "💎 WARRIORS ON BOTH FLANKS MASHING AT MAXIMUM VELOCITY!",
    });

    return items;
  }, [
    customMessages,
    phase,
    wildcard,
    counts.left,
    counts.right,
    winner,
    scoreDiff,
    leftLeading,
    rightLeading,
    isTied,
    isLast5Sec,
    extensionBanner,
    totalScore,
  ]);

  const speedDuration =
    speed === "fast" ? "14s" : speed === "slow" ? "32s" : "22s";

  const getTagColor = (type: TickerItem["type"]) => {
    switch (type) {
      case "cyan":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
      case "amber":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "urgent":
        return "bg-red-500/20 text-red-300 border-red-500/40 animate-pulse";
      case "gold":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
      case "chaos":
        return "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40";
      case "neutral":
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#050913]/90 border-y border-[var(--line-bright)] backdrop-blur-md flex items-center h-10 shadow-lg select-none ${className}`}
      data-testid="live-ticker"
    >
      {/* Fixed Left "LIVE FEED" Esports Badge */}
      <div className="shrink-0 z-20 flex items-center gap-2 px-3.5 h-full bg-gradient-to-r from-[#0d1527] to-[#0a1120] border-r border-[var(--line-bright)] shadow-md">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
        <span className="text-[11px] font-mono-condensed font-black tracking-widest text-slate-100 uppercase">
          LIVE FEED
        </span>
      </div>

      {/* Marquee Scrolling Viewport */}
      <div className="relative flex-1 overflow-hidden h-full flex items-center">
        <div
          className="flex items-center gap-8 whitespace-nowrap will-change-transform animate-ticker"
          style={{ animationDuration: speedDuration }}
        >
          {/* First sequence of ticker items */}
          {tickerItems.map((item) => (
            <div key={item.id} className="inline-flex items-center gap-2.5 text-xs font-mono-condensed">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getTagColor(
                  item.type,
                )}`}
              >
                {item.icon}
                <span>{item.tag}</span>
              </span>
              <span className="text-slate-100 font-semibold tracking-wide uppercase drop-shadow">
                {item.text}
              </span>
              <span className="text-slate-600 px-2">•</span>
            </div>
          ))}

          {/* Duplicated sequence for seamless infinite loop marquee */}
          {tickerItems.map((item) => (
            <div key={`dup-${item.id}`} className="inline-flex items-center gap-2.5 text-xs font-mono-condensed">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getTagColor(
                  item.type,
                )}`}
              >
                {item.icon}
                <span>{item.tag}</span>
              </span>
              <span className="text-slate-100 font-semibold tracking-wide uppercase drop-shadow">
                {item.text}
              </span>
              <span className="text-slate-600 px-2">•</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Edge Neon Accent Glow */}
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#050913] to-transparent pointer-events-none z-10" />
    </div>
  );
};
