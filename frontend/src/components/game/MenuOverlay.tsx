"use client";

import { useState, useEffect } from "react";
import { clsx } from "clsx";

type MenuView = "main" | "names" | "rotate" | "history" | "stats" | "battle-log";

interface MenuOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  players: number;
  playerNames: string[];
  rotations: number[];
  onSaveNames: (names: string[]) => void;
  onRotate: (playerIndex: number) => void;
  onReset: () => void;
  onNewGame: () => void;
  onRequestStatus: () => void;
  onEndGame: () => void;
}

interface LogEntry {
  timestamp: string;
  player_name: string;
  amount_changed: number;
  new_score: number;
}

interface GameHistory {
  id: number;
  date: string;
  player_count: number;
  players: {
    player_name: string;
    score: number;
    is_winner: boolean;
  }[];
}

interface PlayerStats {
  player_name: string;
  games_played: number;
  wins: number;
  losses: number;
  avg_score: number;
}

const factionColors = ["#0088ff", "#11ff00", "#ffcc00", "#ff3300"];

export function MenuOverlay({
  isOpen,
  onClose,
  players,
  playerNames,
  rotations,
  onSaveNames,
  onRotate,
  onReset,
  onNewGame,
  onRequestStatus,
  onEndGame,
}: MenuOverlayProps) {
  const [view, setView] = useState<MenuView>("main");
  const [editedNames, setEditedNames] = useState<string[]>(playerNames);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [battleLog, setBattleLog] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEditedNames(playerNames);
      setView("main");
    }
  }, [isOpen, playerNames]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/games");
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error("Failed to load history", e);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/stats");
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error("Failed to load stats", e);
    }
    setLoading(false);
  };

  const loadBattleLog = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/current_log");
      const data = await res.json();
      setBattleLog(data);
    } catch (e) {
      console.error("Failed to load battle log", e);
    }
    setLoading(false);
  };

  const handleHistoryClick = () => {
    loadHistory();
    setView("history");
  };

  const handleStatsClick = () => {
    loadStats();
    setView("stats");
  };

  const handleBattleLogClick = () => {
    loadBattleLog();
    setView("battle-log");
  };

  const handleSaveNames = () => {
    onSaveNames(editedNames);
    setView("main");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
      <div className="flex min-w-[280px] flex-col gap-4 rounded-xl border-2 border-accent-cyan bg-[#111] p-6 text-center shadow-[0_0_30px_rgba(0,255,234,0.2)]">
        <h2 className="mb-2 text-2xl font-bold tracking-widest text-accent-cyan">
          {view === "main" ? "MENU" : view === "names" ? "PLAYER NAMES" : view === "rotate" ? "ROTATE PLAYERS" : view === "history" ? "MATCH HISTORY" : view === "stats" ? "PLAYER STATISTICS" : "BATTLE LOG"}
        </h2>

        {/* Main Menu */}
        {view === "main" && (
          <div className="flex flex-col gap-3">
            <button onClick={() => setView("names")} className="menu-btn">
              Edit Player Names
            </button>
            <button onClick={() => setView("rotate")} className="menu-btn">
              Rotate Players
            </button>
            <button onClick={onReset} className="menu-btn">
              Reset Authority
            </button>
            <button onClick={onNewGame} className="menu-btn">
              New Game (Setup)
            </button>
            <button onClick={onRequestStatus} className="menu-btn">
              AI Status Report
            </button>
            <button onClick={handleBattleLogClick} className="menu-btn">
              Current Battle Log
            </button>
            <button onClick={handleHistoryClick} className="menu-btn">
              Match History
            </button>
            <button onClick={handleStatsClick} className="menu-btn">
              Player Statistics
            </button>
            <button onClick={onEndGame} className="menu-btn">
              End Game & Save
            </button>
            <button onClick={onClose} className="menu-btn-secondary">
              Close
            </button>
          </div>
        )}

        {/* Edit Names */}
        {view === "names" && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: players }).map((_, i) => (
              <input
                key={i}
                value={editedNames[i]}
                onChange={(e) => {
                  const newNames = [...editedNames];
                  newNames[i] = e.target.value;
                  setEditedNames(newNames);
                }}
                className="w-full rounded-lg border border-accent-cyan bg-black/50 px-3 py-2 text-center text-white outline-none"
                placeholder={`Player ${i + 1}`}
              />
            ))}
            <button onClick={handleSaveNames} className="menu-btn">
              Save
            </button>
            <button onClick={() => setView("main")} className="menu-btn-secondary">
              Cancel
            </button>
          </div>
        )}

        {/* Rotate Players */}
        {view === "rotate" && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: players }).map((_, i) => (
              <button
                key={i}
                onClick={() => onRotate(i)}
                className="menu-btn"
                style={{ borderColor: factionColors[i], color: factionColors[i], background: "transparent", borderWidth: "2px" }}
              >
                Rotate {playerNames[i]}
              </button>
            ))}
            <button onClick={() => setView("main")} className="menu-btn-secondary">
              Back
            </button>
          </div>
        )}

        {/* History */}
        {view === "history" && (
          <div className="max-h-[50vh] overflow-y-auto">
            {loading ? (
              <p>Loading...</p>
            ) : history.length === 0 ? (
              <p>No games played yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {history.map((game) => (
                  <div key={game.id} className="rounded-lg border border-white/20 bg-black/50 p-3 text-left">
                    <div className="mb-2 text-sm text-gray-400">
                      {new Date(game.date).toLocaleDateString()}
                    </div>
                    {game.players.map((p, i) => (
                      <div key={i} className={clsx(p.is_winner && "text-accent-cyan font-bold")}>
                        {p.player_name}: {p.score} {p.is_winner ? "(Winner)" : ""}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setView("main")} className="menu-btn-secondary mt-4">
              Back
            </button>
          </div>
        )}

        {/* Stats */}
        {view === "stats" && (
          <div className="max-h-[50vh] overflow-y-auto">
            {loading ? (
              <p>Loading...</p>
            ) : stats.length === 0 ? (
              <p>No stats available.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {stats.map((s, i) => (
                  <div key={i} className="rounded-lg border border-white/20 bg-black/50 p-3 text-left">
                    <div className="mb-2 font-bold text-white">{s.player_name}</div>
                    <div>Games: {s.games_played}</div>
                    <div className="text-accent-cyan">Wins: {s.wins}</div>
                    <div>Losses: {s.losses}</div>
                    <div>Avg Score: {s.avg_score}</div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setView("main")} className="menu-btn-secondary mt-4">
              Back
            </button>
          </div>
        )}

        {/* Battle Log */}
        {view === "battle-log" && (
          <div className="max-h-[50vh] overflow-y-auto">
            {loading ? (
              <p>Loading...</p>
            ) : battleLog.length === 0 ? (
              <p>No actions logged yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {battleLog.map((log, i) => (
                  <div key={i} className="rounded-lg border border-white/20 bg-black/50 p-3 text-left">
                    <div className="mb-1 text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="font-bold">{log.player_name}</div>
                    <div className={log.amount_changed > 0 ? "text-green-400" : "text-red-400"}>
                      Authority {log.amount_changed > 0 ? "gained" : "lost"} {Math.abs(log.amount_changed)}
                    </div>
                    <div className="text-sm text-gray-400">New Score: {log.new_score}</div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setView("main")} className="menu-btn-secondary mt-4">
              Back
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .menu-btn {
          @apply rounded-lg bg-accent-cyan px-4 py-3 text-lg font-bold uppercase text-black transition-colors hover:bg-cyan-300;
        }
        .menu-btn-secondary {
          @apply rounded-lg border border-white/30 px-4 py-3 text-lg font-bold uppercase text-white transition-colors hover:bg-white/10;
        }
      `}</style>
    </div>
  );
}
