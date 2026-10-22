import { applyAction, isGame, SIZE, same } from './engine.ts';
import type { Action, Game, Point } from './engine.ts';
export type Session = { game: Game; undo: Game[] };
export function playTurn(session: Session, action: Action, human = true): Session {
  const game = applyAction(session.game, action);
  if (game === session.game) return session;
  return { game, undo: human ? [...session.undo, session.game].slice(-30) : session.undo };
}
export function undoTurn(session: Session): Session {
  if (!session.undo.length) return session;
  return { game: session.undo[session.undo.length - 1], undo: session.undo.slice(0, -1) };
}
function upgradeGame(value: unknown, fixedGoal?: Point): Game | null {
  if (isGame(value)) return !fixedGoal || same(value.goal, fixedGoal) ? value : null;
  if (!value || typeof value !== 'object' || 'goal' in value) return null;
  const old = value as Game;
  const candidates: Point[] = fixedGoal ? [fixedGoal] : Array.from({ length: SIZE * SIZE }, (_, i) => ({ r: Math.floor(i / SIZE), c: i % SIZE }));
  candidates.sort((a, b) => Math.abs(a.r - 5) + Math.abs(a.c - 5) - Math.abs(b.r - 5) - Math.abs(b.c - 5));
  for (const goal of candidates) {
    const migrated = { ...old, goal };
    if (isGame(migrated)) return migrated;
  }
  return null;
}
export function restoreSession(value: unknown): Session | null {
  const direct = upgradeGame(value);
  if (direct) return { game: direct, undo: [] };
  if (!value || typeof value !== 'object') return null;
  const data = value as Session, game = upgradeGame(data.game);
  if (!game) return null;
  const undo = Array.isArray(data.undo) && data.undo.length <= 30 ? data.undo.map(g => upgradeGame(g, game.goal)) : [];
  return { game, undo: undo.every(g => g !== null) ? undo as Game[] : [] };
}
