import { LEVEL_COUNT, same } from './engine.ts';
import type { Game } from './engine.ts';
export type Progress = { completed: number[] };
export function restoreProgress(value: unknown): Progress {
  if (!value || typeof value !== 'object' || !Array.isArray((value as Progress).completed)) return { completed: [] };
  const stored = (value as Progress).completed, completed: number[] = [];
  for (let level = 1; level <= LEVEL_COUNT && stored.includes(level); level++) completed.push(level);
  return { completed };
}
export function isUnlocked(progress: Progress, level: number): boolean {
  return Number.isInteger(level) && level >= 1 && level <= LEVEL_COUNT && level <= progress.completed.length + 1;
}
export function recordCompletion(progress: Progress, game: Game): Progress {
  if (game.winner === null || !game.players[game.winner] || game.players[game.winner].bot || !same(game.players[game.winner].position, game.goal) || !game.level || !isUnlocked(progress, game.level) || progress.completed.includes(game.level)) return progress;
  return { completed: [...progress.completed, game.level].sort((a, b) => a - b) };
}
