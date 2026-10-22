import { applyAction, isGame } from './engine.ts';
import type { Action, Game } from './engine.ts';
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
export function restoreSession(value: unknown): Session | null {
  if (isGame(value)) return { game: value, undo: [] }; // Upgrade v1 saves.
  if (!value || typeof value !== 'object') return null;
  const data = value as Session;
  if (!isGame(data.game)) return null;
  return { game: data.game, undo: Array.isArray(data.undo) && data.undo.length <= 30 && data.undo.every(isGame) ? data.undo : [] };
}
