export const SIZE = 11;
export const COLORS = ['#20caff', '#ffbf24', '#24df86', '#ff4c78'];
export type Point = { r: number; c: number };
export type Wall = Point & { direction: 'h' | 'v'; owner: number };
export type Player = { name: string; color: string; position: Point; walls: number; bot: boolean };
export type Game = { players: Player[]; walls: Wall[]; turn: number; winner: number | null; moves: number; log: string };
export type Action = { type: 'move'; to: Point } | { type: 'wall'; wall: Wall };
export const same = (a: Point, b: Point) => a.r === b.r && a.c === b.c;
const inside = (p: Point) => Number.isInteger(p.r) && Number.isInteger(p.c) && p.r >= 0 && p.r < SIZE && p.c >= 0 && p.c < SIZE;
const directions = [[-1, 0], [0, -1], [0, 1], [1, 0]];
export function createGame(count = 2, bots = true): Game {
  const columns = count === 2 ? [3, 7] : count === 3 ? [2, 5, 8] : [1, 4, 6, 9];
  return { players: columns.map((c, i) => ({ name: i === 0 ? 'You' : bots ? `CPU ${i}` : `Player ${i + 1}`, color: COLORS[i], position: { r: SIZE - 1, c }, walls: 8, bot: bots && i > 0 })), walls: [], turn: 0, winner: null, moves: 0, log: 'Reach the gold edge. Every move matters.' };
}
export function blocked(a: Point, b: Point, walls: Wall[]): boolean {
  return walls.some(w => w.direction === 'h'
    ? a.c === b.c && Math.min(a.r, b.r) === w.r && a.r !== b.r && (a.c === w.c || a.c === w.c + 1)
    : a.r === b.r && Math.min(a.c, b.c) === w.c && a.c !== b.c && (a.r === w.r || a.r === w.r + 1));
}
export function route(start: Point, walls: Wall[]): Point[] | null {
  const queue: Point[][] = [[start]], visited = new Set([`${start.r},${start.c}`]);
  for (let q = 0; q < queue.length; q++) {
    const path = queue[q], p = path[path.length - 1];
    if (p.r === 0) return path;
    for (const [dr, dc] of directions) {
      const n = { r: p.r + dr, c: p.c + dc }, key = `${n.r},${n.c}`;
      if (inside(n) && !visited.has(key) && !blocked(p, n, walls)) { visited.add(key); queue.push([...path, n]); }
    }
  }
  return null;
}
export function legalMoves(game: Game, index = game.turn): Point[] {
  const p = game.players[index].position, result: Point[] = [];
  const occupied = (n: Point) => game.players.some((x, i) => i !== index && same(n, x.position));
  for (const [dr, dc] of directions) {
    const next = { r: p.r + dr, c: p.c + dc };
    if (!inside(next) || blocked(p, next, game.walls)) continue;
    if (!occupied(next)) { result.push(next); continue; }
    const jump = { r: next.r + dr, c: next.c + dc };
    if (inside(jump) && !blocked(next, jump, game.walls) && !occupied(jump)) { result.push(jump); continue; }
    for (const [sr, sc] of dr ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]]) {
      const diagonal = { r: next.r + sr, c: next.c + sc };
      if (inside(diagonal) && !blocked(next, diagonal, game.walls) && !occupied(diagonal)) result.push(diagonal);
    }
  }
  return result.filter((v, i, a) => a.findIndex(x => same(v, x)) === i);
}
export function wallError(game: Game, wall: Wall): string | null {
  if (game.winner !== null) return 'This match is finished.';
  if (wall.owner !== game.turn) return 'Wait for your turn.';
  if (game.players[game.turn].walls <= 0) return 'No barricades left. Move your pawn.';
  if (!Number.isInteger(wall.r) || !Number.isInteger(wall.c) || wall.r < 0 || wall.r >= SIZE - 1 || wall.c < 0 || wall.c >= SIZE - 1 || !['h', 'v'].includes(wall.direction)) return 'Place inside the board.';
  for (const w of game.walls) {
    if (w.direction === wall.direction && (w.direction === 'h' ? w.r === wall.r && Math.abs(w.c - wall.c) < 2 : w.c === wall.c && Math.abs(w.r - wall.r) < 2)) return 'Barricades cannot overlap.';
    if (w.direction !== wall.direction && same(w, wall)) return 'Barricades cannot cross.';
  }
  if (game.players.some(p => !route(p.position, [...game.walls, wall]))) return 'Leave every player a route to the gold edge.';
  return null;
}
export function applyAction(game: Game, action: Action): Game {
  if (game.winner !== null) return game;
  const next: Game = { ...game, players: game.players.map(p => ({ ...p, position: { ...p.position } })), walls: [...game.walls] };
  const player = next.players[game.turn];
  if (action.type === 'move') {
    if (!legalMoves(game).some(p => same(p, action.to))) return game;
    player.position = { ...action.to };
    next.log = `${player.name} moved a step closer.`;
    if (action.to.r === 0) { next.winner = game.turn; next.log = `${player.name} reached the gold edge!`; }
  } else {
    if (wallError(game, action.wall)) return game;
    next.walls.push({ ...action.wall }); player.walls--;
    next.log = `${player.name} placed a barricade.`;
  }
  next.moves++;
  if (next.winner === null) next.turn = (game.turn + 1) % game.players.length;
  return next;
}
export function botAction(game: Game, tactical = true): Action {
  const index = game.turn, player = game.players[index], moves = legalMoves(game);
  const distance = (p: Point, walls: Wall[]) => (route(p, walls)?.length ?? 999) - 1;
  const best = [...moves].sort((a, b) => distance(a, game.walls) - distance(b, game.walls))[0];
  if (!best) throw new Error('No legal move');
  if (best.r === 0) return { type: 'move', to: best };
  if (tactical && player.walls > 0) {
    const opponents = game.players.map((p, i) => ({ p, i, d: distance(p.position, game.walls) })).filter(x => x.i !== index).sort((a, b) => a.d - b.d);
    const target = opponents[0], path = route(target.p.position, game.walls) ?? [];
    let chosen: Wall | undefined, score = 1;
    for (const step of path.slice(0, 4)) for (const direction of ['h', 'v'] as const) for (const offset of [-1, 0]) {
      const wall = { r: Math.min(9, step.r + (direction === 'v' ? offset : -1)), c: Math.min(9, step.c + (direction === 'h' ? offset : -1)), direction, owner: index };
      if (wallError(game, wall)) continue;
      const walls = [...game.walls, wall];
      const value = distance(target.p.position, walls) - target.d - (distance(player.position, walls) - distance(player.position, game.walls));
      if (value > score && target.d <= distance(player.position, game.walls) + 1) { score = value; chosen = wall; }
    }
    if (chosen) return { type: 'wall', wall: chosen };
  }
  return { type: 'move', to: best };
}
export function isGame(value: unknown): value is Game {
  if (!value || typeof value !== 'object') return false;
  const g = value as Game;
  if (!Array.isArray(g.players) || g.players.length < 2 || g.players.length > 4 || !Array.isArray(g.walls) || g.walls.length > 32 || !Number.isInteger(g.turn) || g.turn < 0 || g.turn >= g.players.length || !Number.isInteger(g.moves) || g.moves < 0 || typeof g.log !== 'string') return false;
  if (!g.players.every(p => p && typeof p.name === 'string' && COLORS.includes(p.color) && typeof p.bot === 'boolean' && p.position && inside(p.position) && Number.isInteger(p.walls) && p.walls >= 0 && p.walls <= 8)) return false;
  if (g.players.some((p, i) => g.players.some((q, j) => i !== j && same(p.position, q.position)))) return false;
  if (!g.walls.every(w => w && Number.isInteger(w.r) && Number.isInteger(w.c) && w.r >= 0 && w.r < 10 && w.c >= 0 && w.c < 10 && ['h', 'v'].includes(w.direction) && Number.isInteger(w.owner) && w.owner >= 0 && w.owner < g.players.length)) return false;
  if (g.winner !== null && (!Number.isInteger(g.winner) || !g.players[g.winner] || g.players[g.winner].position.r !== 0)) return false;
  return g.players.every(p => route(p.position, g.walls) !== null);
}
