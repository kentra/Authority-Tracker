"use client";

import { useState } from "react";

interface SetupScreenProps {
  onStartGame: (players: number, startingAuth: number) => void;
}

export function SetupScreen({ onStartGame }: SetupScreenProps) {
  const [players, setPlayers] = useState(2);
  const [startingAuth, setStartingAuth] = useState(50);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 text-center">
      <div id="stars" className="fixed inset-0 -z-10 animate-zoom" />
      <div id="stars2" className="fixed inset-0 -z-10 animate-zoom" style={{ animationDuration: "30s", opacity: 0.3 }} />
      
      <h1 className="mb-8 text-5xl font-black tracking-wider text-foreground">
        AUTHORITY<br />
        <span className="text-accent-cyan">TRACKER</span>
      </h1>
      
      <div className="flex w-full max-w-xs flex-col gap-4">
        <label className="text-xl font-bold">Players:</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((count) => (
            <button
              key={count}
              onClick={() => setPlayers(count)}
              className={`flex-1 rounded-lg border border-white/20 bg-white/10 py-4 text-2xl font-bold transition-all ${
                players === count
                  ? "bg-accent-cyan text-black shadow-[0_0_15px_var(--color-accent-cyan)]"
                  : "text-white hover:bg-white/20"
              }`}
            >
              {count}
            </button>
          ))}
        </div>
        
        <label className="mt-4 text-xl font-bold">Starting Authority:</label>
        <input
          type="number"
          value={startingAuth}
          onChange={(e) => setStartingAuth(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-full rounded-lg border-2 border-accent-cyan bg-black/50 px-4 py-4 text-center text-3xl text-white outline-none"
          min={1}
          max={999}
        />
        
        <button
          onClick={() => onStartGame(players, startingAuth)}
          className="mt-6 rounded-lg bg-accent-cyan py-4 text-2xl font-bold text-black shadow-[0_0_20px_rgba(0,255,234,0.4)] uppercase transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Start Game
        </button>
      </div>
    </div>
  );
}
