"use client";

import { useState, useEffect } from "react";
import { clsx } from "clsx";

interface TrackerWidgetProps {
  playerIndex: number;
  playerName: string;
  authority: number;
  factionColor: string;
  rotation: number;
  onAdjust: (amount: number) => void;
}

const factionColors = [
  "text-p1 shadow-[0_0_10px_#0088ff]",
  "text-p2 shadow-[0_0_10px_#11ff00]",
  "text-p3 shadow-[0_0_10px_#ffcc00]",
  "text-p4 shadow-[0_0_10px_#ff3300]",
];

export function TrackerWidget({
  playerIndex,
  playerName,
  authority,
  factionColor,
  rotation,
  onAdjust,
}: TrackerWidgetProps) {
  const [diff, setDiff] = useState(0);
  const [isPop, setIsPop] = useState(false);

  useEffect(() => {
    if (diff !== 0) {
      const timer = setTimeout(() => {
        setDiff(0);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [diff]);

  const handleAdjust = (amount: number) => {
    setDiff((prev) => prev + amount);
    setIsPop(true);
    setTimeout(() => setIsPop(false), 100);
    onAdjust(amount);
  };

  const colorClass = factionColors[playerIndex % 4];

  return (
    <div
      className="relative flex flex-1 items-center justify-center overflow-hidden border border-white/10 bg-black/40"
      style={{
        transform: `rotate(${rotation}deg)`,
      }}
    >
      {/* Faction overlay */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-15"
        style={{
          background: `radial-gradient(circle, ${factionColor} 0%, transparent 70%)`,
        }}
      />

      <div className="flex flex-col items-center justify-center p-3">
        <div
          className="mb-2 text-xl font-bold uppercase tracking-widest opacity-80"
          style={{ color: factionColor }}
        >
          {playerName}
        </div>

        <div
          className={clsx(
            "text-7xl font-black leading-none transition-transform",
            colorClass,
            isPop && "scale-110"
          )}
          style={{ textShadow: `0 0 10px ${factionColor}` }}
        >
          {authority}
        </div>

        <div
          className={clsx(
            "mt-2 min-h-[1.5rem] text-lg opacity-0 transition-opacity",
            diff > 0 && "text-green-400 opacity-100",
            diff < 0 && "text-red-400 opacity-100"
          )}
        >
          {diff > 0 ? `+${diff}` : diff}
        </div>

        <div className="mt-4 flex w-full justify-center gap-2">
          <button
            onClick={() => handleAdjust(-5)}
            className="flex-1 rounded-lg border border-white/20 bg-white/10 py-3 text-xl font-bold text-red-400 transition-colors hover:bg-white/30"
          >
            -5
          </button>
          <button
            onClick={() => handleAdjust(-1)}
            className="flex-1 rounded-lg border border-white/20 bg-white/10 py-3 text-xl font-bold text-red-400 transition-colors hover:bg-white/30"
          >
            -1
          </button>
          <button
            onClick={() => handleAdjust(1)}
            className="flex-1 rounded-lg border border-white/20 bg-white/10 py-3 text-xl font-bold text-green-400 transition-colors hover:bg-white/30"
          >
            +1
          </button>
          <button
            onClick={() => handleAdjust(5)}
            className="flex-1 rounded-lg border border-white/20 bg-white/10 py-3 text-xl font-bold text-green-400 transition-colors hover:bg-white/30"
          >
            +5
          </button>
        </div>
      </div>
    </div>
  );
}
