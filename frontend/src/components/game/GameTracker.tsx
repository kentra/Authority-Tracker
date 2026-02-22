"use client";

import { TrackerWidget } from "./TrackerWidget";

interface GameTrackerProps {
  players: number;
  playerNames: string[];
  authority: number[];
  rotations: number[];
  onAdjust: (playerIndex: number, amount: number) => void;
}

const factionColors = ["#0088ff", "#11ff00", "#ffcc00", "#ff3300"];

export function GameTracker({
  players,
  playerNames,
  authority,
  rotations,
  onAdjust,
}: GameTrackerProps) {
  const layoutClasses = {
    1: "flex-col",
    2: "flex-col",
    3: "flex-row flex-wrap",
    4: "flex-row flex-wrap",
  };

  const sizeClasses = {
    1: "flex-1",
    2: "flex-1",
    3: "w-1/2 h-1/2",
    4: "w-1/2 h-1/2",
  };

  return (
    <div className={`flex w-full h-full ${layoutClasses[players as keyof typeof layoutClasses]}`}>
      {Array.from({ length: players }).map((_, index) => (
        <div
          key={index}
          className={players === 3 && index === 2 ? "w-full" : sizeClasses[players as keyof typeof sizeClasses]}
        >
          <TrackerWidget
            playerIndex={index}
            playerName={playerNames[index]}
            authority={authority[index]}
            factionColor={factionColors[index % 4]}
            rotation={rotations[index]}
            onAdjust={(amount) => onAdjust(index, amount)}
          />
        </div>
      ))}
    </div>
  );
}
