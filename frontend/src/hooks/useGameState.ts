"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export interface GameState {
  game_id: number | null;
  players: number;
  startingAuth: number;
  authValues: number[];
  playerNames: string[];
  rotations: number[];
}

interface UseGameStateReturn {
  gameState: GameState;
  isConnected: boolean;
  screen: "setup" | "game";
  startGame: (players: number, startingAuth: number) => void;
  adjustAuthority: (playerIndex: number, amount: number) => void;
  saveNames: (names: string[]) => void;
  rotatePlayer: (playerIndex: number) => void;
  resetGame: () => void;
  requestStatusReport: () => void;
  endGame: () => Promise<void>;
  setScreen: (screen: "setup" | "game") => void;
}

const defaultState: GameState = {
  game_id: null,
  players: 2,
  startingAuth: 50,
  authValues: [50, 50],
  playerNames: ["Player 1", "Player 2", "Player 3", "Player 4"],
  rotations: [0, 0, 0, 0],
};

export function useGameState(): UseGameStateReturn {
  const [gameState, setGameState] = useState<GameState>(defaultState);
  const [isConnected, setIsConnected] = useState(false);
  const [screen, setScreen] = useState<"setup" | "game">("setup");
  const socketRef = useRef<Socket | null>(null);
  const isSyncing = useRef(false);

  useEffect(() => {
    // Connect to Socket.IO
    socketRef.current = io({
      transports: ["websocket", "polling"],
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("Connected to server");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from server");
      setIsConnected(false);
    });

    socket.on("state_updated", (newState: GameState) => {
      isSyncing.current = true;
      setGameState(newState);
      
      // Check if we need to switch screens
      if (newState.game_id && screen !== "game") {
        setScreen("game");
      }
      
      isSyncing.current = false;
    });

    socket.on("play_audio", (data: { audio: string }) => {
      const audioSrc = `data:audio/mp3;base64,${data.audio}`;
      const audio = new Audio(audioSrc);
      audio.play().catch((e) => console.error("Audio play failed:", e));
    });

    // Load initial state
    fetch("/api/v1/state")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.players) {
          setGameState(data);
          setScreen("game");
        }
      })
      .catch(console.error);

    return () => {
      socket.disconnect();
    };
  }, []);

  const broadcastState = useCallback((state: GameState) => {
    if (!isSyncing.current && socketRef.current) {
      socketRef.current.emit("state_change", state);
    }
  }, []);

  const startGame = useCallback((players: number, startingAuth: number) => {
    const newState: GameState = {
      ...gameState,
      players,
      startingAuth,
      authValues: Array(players).fill(startingAuth),
      playerNames: Array(players).fill(0).map((_, i) => gameState.playerNames[i] || `Player ${i + 1}`),
      rotations: players === 2 ? [180, 0, 0, 0] : [0, 0, 0, 0],
      game_id: null,
    };
    
    setGameState(newState);
    setScreen("game");
    socketRef.current?.emit("start_game", newState);
  }, [gameState]);

  const adjustAuthority = useCallback((playerIndex: number, amount: number) => {
    const newAuthValues = [...gameState.authValues];
    newAuthValues[playerIndex] = Math.max(0, newAuthValues[playerIndex] + amount);
    
    const newState: GameState = {
      ...gameState,
      authValues: newAuthValues,
    };
    
    setGameState(newState);
    broadcastState(newState);

    // Log the action after a delay (to accumulate rapid clicks)
    const logEntry = {
      timestamp: new Date().toISOString(),
      player_name: gameState.playerNames[playerIndex],
      amount_changed: amount,
      new_score: newAuthValues[playerIndex],
    };
    
    // Accumulate diffs similar to original - simplified here
    socketRef.current?.emit("log_action", logEntry);
  }, [gameState, broadcastState]);

  const saveNames = useCallback((names: string[]) => {
    const newState: GameState = {
      ...gameState,
      playerNames: names,
    };
    setGameState(newState);
    broadcastState(newState);
  }, [gameState, broadcastState]);

  const rotatePlayer = useCallback((playerIndex: number) => {
    const newRotations = [...gameState.rotations];
    newRotations[playerIndex] = (newRotations[playerIndex] + 90) % 360;
    
    const newState: GameState = {
      ...gameState,
      rotations: newRotations,
    };
    setGameState(newState);
    broadcastState(newState);
  }, [gameState, broadcastState]);

  const resetGame = useCallback(() => {
    const newState: GameState = {
      ...gameState,
      authValues: Array(gameState.players).fill(gameState.startingAuth),
    };
    setGameState(newState);
    socketRef.current?.emit("start_game", newState);
  }, [gameState]);

  const requestStatusReport = useCallback(() => {
    socketRef.current?.emit("request_status_report");
  }, []);

  const endGame = useCallback(async () => {
    const maxScore = Math.max(...gameState.authValues);
    
    const gameData = {
      player_count: gameState.players,
      players: gameState.playerNames.slice(0, gameState.players).map((name, i) => ({
        player_name: name,
        score: gameState.authValues[i],
        is_winner: gameState.authValues[i] === maxScore,
      })),
      logs: [],
    };

    await fetch("/api/v1/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gameData),
    });

    // Reset to setup
    setGameState(defaultState);
    setScreen("setup");
  }, [gameState]);

  return {
    gameState,
    isConnected,
    screen,
    startGame,
    adjustAuthority,
    saveNames,
    rotatePlayer,
    resetGame,
    requestStatusReport,
    endGame,
    setScreen,
  };
}
