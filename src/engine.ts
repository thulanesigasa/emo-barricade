export const SIZE = 11;
export const COLORS = ['#20caff', '#ffbf24', '#24df86', '#ff4c78'];
export type Point = { r: number; c: number };
export type Wall = Point & { direction: 'h' | 'v'; owner: number };
export type Player = { name: string; color: string; position: Point; walls: number; bot: boolean };
export const LAYOUTS = ['Open', 'Crossroads', 'Switchback'] as const;
export type Layout = typeof LAYOUTS[number];
export const LEVEL_COUNT = 12;
export type Game = { goal: Point; level?: number; startDistance?: number; layout?: Layout; players: Player[]; walls: Wall[]; turn: number; winner: number | null; moves: number; log: string };
export type Action = { type: 'move'; to: Point } | { type: 'wall'; wall: Wall } | { type: 'pass' };
export const same = (a: Point, b: Point) => a.r === b.r && a.c === b.c;
const inside = (p: Point) => Number.isInteger(p.r) && Number.isInteger(p.c) && p.r >= 0 && p.r < SIZE && p.c >= 0 && p.c < SIZE;
const directions = [[-1, 0], [0, -1], [0, 1], [1, 0]];
const GOALS: Point[] = [
  { r: 5, c: 5 }, { r: 2, c: 8 }, { r: 8, c: 2 }, { r: 1, c: 5 },
  { r: 9, c: 7 }, { r: 5, c: 1 }, { r: 4, c: 9 }, { r: 8, c: 8 },
  { r: 2, c: 2 }, { r: 5, c: 8 }, { r: 8, c: 5 }, { r: 2, c: 5 }
];
function collision(wall: Wall, walls: Wall[]): boolean {
  return walls.some(w => w.direction === wall.direction
    ? (w.direction === 'h' ? w.r === wall.r && Math.abs(w.c - wall.c) < 2 : w.c === wall.c && Math.abs(w.r - wall.r) < 2)
    : same(w, wall));
}
export function distancesToGoal(walls: Wall[], goal: Point): number[][] {
  const distance = Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(-1));
  const queue: Point[] = [goal]; distance[goal.r][goal.c] = 0;
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (const [dr, dc] of directions) {
      const n = { r: p.r + dr, c: p.c + dc };
      if (inside(n) && distance[n.r][n.c] < 0 && !blocked(p, n, walls)) {
        distance[n.r][n.c] = distance[p.r][p.c] + 1; queue.push(n);
      }
    }
  }
  return distance;
}
export function createGame(count = 2, bots = true, layout: Layout = 'Open', level = 1): Game {
  if (!Number.isInteger(level) || level < 1 || level > LEVEL_COUNT || ![2, 3, 4].includes(count) || !LAYOUTS.includes(layout)) throw new Error('Invalid level settings');
  const goal = { ...GOALS[level - 1] }, walls: Wall[] = [];
  let seed = level * 8917 + LAYOUTS.indexOf(layout) * 101 + count;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const presets: Record<Layout, [number, number, 'h' | 'v'][]> = {
    Open: [],
    Crossroads: [[7, 1, 'h'], [7, 8, 'h'], [4, 3, 'v'], [4, 6, 'v'], [2, 4, 'h']],
    Switchback: [[8, 2, 'h'], [8, 7, 'h'], [5, 0, 'h'], [5, 5, 'h'], [5, 8, 'h'], [2, 2, 'h'], [2, 7, 'h']]
  };
  const add = (r: number, c: number, direction: 'h' | 'v') => {
    const wall: Wall = { r, c, direction, owner: walls.length % count };
    if (!collision(wall, walls) && distancesToGoal([...walls, wall], goal).every(row => row.every(d => d >= 0))) walls.push(wall);
  };
  for (const [r, c, direction] of presets[layout]) add(r, c, direction);
  const wallCount = Math.min(18, walls.length + (level - 1) * 2);
  for (let attempt = 0; walls.length < wallCount && attempt < 300; attempt++) add(Math.floor(random() * 10), Math.floor(random() * 10), random() < 0.5 ? 'h' : 'v');
  const distance = distancesToGoal(walls, goal), buckets = new Map<number, Point[]>();
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const d = distance[r][c];
    if (d >= 6 && Math.abs(r - goal.r) + Math.abs(c - goal.c) >= 4) {
      const points = buckets.get(d) ?? []; points.push({ r, c }); buckets.set(d, points);
    }
  }
  const target = Math.min(12, 6 + Math.floor(level / 2));
  let starts: Point[] | null = null, startDistance = 0;
  for (const d of [...buckets.keys()].sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b)) {
    const points = buckets.get(d)!;
    for (let i = points.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [points[i], points[j]] = [points[j], points[i]]; }
    const choose = (from: number, chosen: Point[]): Point[] | null => {
      if (chosen.length === count) return chosen;
      for (let i = from; i < points.length; i++) {
        const p = points[i];
        if (chosen.every(q => Math.abs(p.r - q.r) + Math.abs(p.c - q.c) >= 4)) {
          const result = choose(i + 1, [...chosen, p]); if (result) return result;
        }
      }
      return null;
    };
    starts = choose(0, []); if (starts) { startDistance = d; break; }
  }
  if (!starts) throw new Error('Could not create fair starting positions');
  return { goal, level, startDistance, layout,
    players: starts.map((position, i) => ({ name: i === 0 ? 'You' : bots ? `CPU ${i}` : `Player ${i + 1}`, color: COLORS[i], position, walls: 8, bot: bots && i > 0 })),
    walls, turn: (level - 1) % count, winner: null, moves: 0, log: `Level ${level}: reach the single gold square.` };
}
export function blocked(a: Point, b: Point, walls: Wall[]): boolean {
  return walls.some(w => w.direction === 'h'
    ? a.c === b.c && Math.min(a.r, b.r) === w.r && a.r !== b.r && (a.c === w.c || a.c === w.c + 1)
    : a.r === b.r && Math.min(a.c, b.c) === w.c && a.c !== b.c && (a.r === w.r || a.r === w.r + 1));
}
export function route(start: Point, walls: Wall[], goal: Point): Point[] | null {
  const queue: Point[][] = [[start]], visited = new Set([`${start.r},${start.c}`]);
  for (let q = 0; q < queue.length; q++) {
    const path = queue[q], p = path[path.length - 1];
    if (same(p, goal)) return path;
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
  if (game.players.some(p => !route(p.position, [...game.walls, wall], game.goal))) return 'Leave every player a route to the gold square.';
  return null;
}
export function applyAction(game: Game, action: Action): Game {
  if (game.winner !== null) return game;
  const next: Game = { ...game, players: game.players.map(p => ({ ...p, position: { ...p.position } })), walls: [...game.walls] };
  const player = next.players[game.turn];
  if (action.type === 'pass') {
    if (legalMoves(game).length > 0) return game;
    next.log = `${player.name} had no available pawn move and passed.`;
  } else if (action.type === 'move') {
    if (!legalMoves(game).some(p => same(p, action.to))) return game;
    player.position = { ...action.to };
    next.log = `${player.name} moved a pawn.`;
    if (same(action.to, game.goal)) { next.winner = game.turn; next.log = `${player.name} reached the gold square!`; }
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
  const distance = (p: Point, walls: Wall[]) => (route(p, walls, game.goal)?.length ?? 999) - 1;
  const best = [...moves].sort((a, b) => distance(a, game.walls) - distance(b, game.walls))[0];
  if (!best) return { type: 'pass' };
  if (same(best, game.goal)) return { type: 'move', to: best };
  if (tactical && player.walls > 0) {
    const opponents = game.players.map((p, i) => ({ p, i, d: distance(p.position, game.walls) })).filter(x => x.i !== index).sort((a, b) => a.d - b.d);
    const target = opponents[0], path = route(target.p.position, game.walls, game.goal) ?? [];
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
  if (!g.goal || !inside(g.goal)) return false;
  if (g.level !== undefined && (!Number.isInteger(g.level) || g.level < 1 || g.level > LEVEL_COUNT)) return false;
  if (g.startDistance !== undefined && (!Number.isInteger(g.startDistance) || g.startDistance < 6)) return false;
  if (g.layout !== undefined && !LAYOUTS.includes(g.layout)) return false;
  if (!Array.isArray(g.players) || g.players.length < 2 || g.players.length > 4 || !Array.isArray(g.walls) || g.walls.length > 64 || !Number.isInteger(g.turn) || g.turn < 0 || g.turn >= g.players.length || !Number.isInteger(g.moves) || g.moves < 0 || typeof g.log !== 'string') return false;
  if (!g.players.every(p => p && typeof p.name === 'string' && COLORS.includes(p.color) && typeof p.bot === 'boolean' && p.position && inside(p.position) && Number.isInteger(p.walls) && p.walls >= 0 && p.walls <= 8)) return false;
  if (g.players.some((p, i) => g.players.some((q, j) => i !== j && same(p.position, q.position)))) return false;
  if (!g.walls.every(w => w && Number.isInteger(w.r) && Number.isInteger(w.c) && w.r >= 0 && w.r < 10 && w.c >= 0 && w.c < 10 && ['h', 'v'].includes(w.direction) && Number.isInteger(w.owner) && w.owner >= 0 && w.owner < g.players.length)) return false;
  if (g.winner === null && g.players.some(p => same(p.position, g.goal))) return false;
  if (g.winner !== null && (!Number.isInteger(g.winner) || !g.players[g.winner] || !same(g.players[g.winner].position, g.goal))) return false;
  return g.players.every(p => route(p.position, g.walls, g.goal) !== null);
}

