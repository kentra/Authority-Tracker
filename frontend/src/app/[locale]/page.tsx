"use client";

import { useState } from "react";
import { SetupScreen } from "@/components/game/SetupScreen";
import { GameTracker } from "@/components/game/GameTracker";
import { MenuOverlay } from "@/components/game/MenuOverlay";
import { useGameState } from "@/hooks/useGameState";

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default function HomePage({ params }: PageProps) {
  const {
    gameState,
    screen,
    startGame,
    adjustAuthority,
    saveNames,
    rotatePlayer,
    resetGame,
    requestStatusReport,
    endGame,
  } = useGameState();

  const [menuOpen, setMenuOpen] = useState(false);

  if (screen === "setup") {
    return <SetupScreen onStartGame={startGame} />;
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Starfield Background */}
      <div 
        className="fixed inset-0 -z-10 animate-zoom" 
        style={{
          background: `radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)`,
        }}
      />
      <div 
        id="stars"
        className="pointer-events-none fixed inset-0 -z-10 opacity-50"
        style={{
          backgroundImage: `
            radial-gradient(1px 1px at 20px 30px, #eee, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 40px 70px, #fff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 50px 160px, #ddd, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 90px 40px, #fff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 130px 80px, #fff, rgba(0,0,0,0)),
            radial-gradient(1.5px 1.5px at 160px 120px, #ddd, rgba(0,0,0,0))
          `,
          backgroundRepeat: "repeat",
          backgroundSize: "200px 200px",
        }} 
      />

      {/* Game Tracker */}
      <GameTracker
        players={gameState.players}
        playerNames={gameState.playerNames}
        authority={gameState.authValues}
        rotations={gameState.rotations}
        onAdjust={adjustAuthority}
      />

      {/* Menu Button */}
      <button
        onClick={() => setMenuOpen(true)}
        className="fixed bottom-5 right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-accent-cyan text-black shadow-[0_0_15px_rgba(0,255,234,0.5)] transition-transform hover:scale-105"
        aria-label="Menu"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-8 h-8">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>

      {/* Menu Overlay */}
      <MenuOverlay
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        players={gameState.players}
        playerNames={gameState.playerNames}
        rotations={gameState.rotations}
        onSaveNames={saveNames}
        onRotate={rotatePlayer}
        onReset={() => {
          resetGame();
          setMenuOpen(false);
        }}
        onNewGame={() => {
          setMenuOpen(false);
          window.location.reload();
        }}
        onRequestStatus={requestStatusReport}
        onEndGame={async () => {
          await endGame();
          setMenuOpen(false);
        }}
      />
    </div>
  );
}
