import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, legalMoves, blocked, route, wallError, applyAction, botAction, isGame } from '../src/engine.ts';
test('2–4 players start on distinct squares with a route and eight walls', () => {
  for (const count of [2,3,4]) { const g = createGame(count); assert.equal(g.players.length, count); assert.ok(isGame(g)); assert.ok(g.players.every(p => p.walls === 8 && route(p.position, g.walls, g.goal).length === g.startDistance + 1)); }
});
test('move consumes exactly one turn and leaves input immutable', () => {
  const g = createGame(); g.players[0].position={r:10,c:3}; g.players[1].position={r:10,c:7}; const next = applyAction(g, { type: 'move', to: { r: 9, c: 3 } });
  assert.equal(next.turn, 1); assert.equal(next.moves, 1); assert.equal(g.players[0].position.r, 10);
  assert.equal(applyAction(g, { type: 'move', to: { r: 3, c: 3 } }), g);
});
test('horizontal and vertical walls block both covered edges symmetrically', () => {
  const h = [{ r: 4, c: 3, direction: 'h', owner: 0 }];
  assert.ok(blocked({r:4,c:3},{r:5,c:3},h)); assert.ok(blocked({r:5,c:4},{r:4,c:4},h));
  assert.equal(blocked({r:4,c:5},{r:5,c:5},h), false);
  const v = [{r:4,c:3,direction:'v',owner:0}];
  assert.ok(blocked({r:4,c:3},{r:4,c:4},v)); assert.ok(blocked({r:5,c:4},{r:5,c:3},v));
});
test('wall placement deducts a wall; overlap, crossing, bad owner and bounds are rejected', () => {
  const g = createGame(2, false); const wall = {r:4,c:3,direction:'h',owner:0};
  const next = applyAction(g, {type:'wall',wall}); assert.equal(next.players[0].walls,7); assert.equal(next.turn,1);
  assert.match(wallError(next,{...wall,owner:1,c:4}),/overlap/);
  assert.match(wallError(next,{...wall,owner:1,direction:'v'}),/cross/);
  assert.ok(wallError(g,{...wall,c:10})); assert.ok(wallError(g,{...wall,owner:1}));
});
test('a wall cannot seal a player in a corner even though the goal remains open', () => {
  const g = createGame(); g.players[0].position = {r:10,c:0}; g.walls=[{r:8,c:0,direction:'h',owner:1}];
  assert.match(wallError(g,{r:9,c:1,direction:'v',owner:0}),/route/);
  assert.equal(applyAction(g,{type:'wall',wall:{r:9,c:1,direction:'v',owner:0}}),g);
});
test('a neighbouring pawn can be jumped; a wall behind it allows diagonals', () => {
  const g = createGame(); g.players[0].position={r:5,c:5}; g.players[1].position={r:4,c:5};
  assert.ok(legalMoves(g).some(p=>p.r===3&&p.c===5));
  assert.ok(!legalMoves(g).some(p=>p.r===4&&p.c===5));
  g.walls=[{r:3,c:5,direction:'h',owner:0}];
  assert.ok(legalMoves(g).some(p=>p.r===4&&p.c===4)); assert.ok(legalMoves(g).some(p=>p.r===4&&p.c===6));
});
test('first player to gold wins and further actions cannot change the game', () => {
  const g=createGame();g.goal={r:0,c:3};g.players[0].position={r:1,c:3};
  const won=applyAction(g,{type:'move',to:{r:0,c:3}});assert.equal(won.winner,0);
  assert.equal(applyAction(won,{type:'move',to:{r:1,c:3}}),won);
});
test('computer games complete without illegal actions or cutting off a route', () => {
  for(const count of [2,3,4]) for(const tactical of [true,false]) {
    let g=createGame(count);
    for(let n=0;n<300&&g.winner===null;n++) { const next=applyAction(g,botAction(g,tactical)); assert.notEqual(next,g);g=next;assert.ok(isGame(g)); }
    assert.notEqual(g.winner,null);
  }
});
test('invalid persisted data is rejected',()=>{
  assert.equal(isGame(null),false);assert.equal(isGame({}),false);
  const g=createGame();g.players[0].position.c=NaN;assert.equal(isGame(g),false);
  const other=createGame();other.turn=9;assert.equal(isGame(other),false);
});
test('passing is allowed only when no pawn move exists',()=>{
  const g=createGame(4,false);
  assert.equal(applyAction(g,{type:'pass'}),g);
  g.players[0].position={r:10,c:0};
  g.players[1].position={r:9,c:0};
  g.players[2].position={r:8,c:0};
  g.players[3].position={r:10,c:9};
  g.walls=[{r:9,c:0,direction:'v',owner:1}];
  assert.equal(legalMoves(g).length,0);
  assert.equal(botAction(g).type,'pass');
  const next=applyAction(g,{type:'pass'});assert.equal(next.turn,1);assert.equal(next.moves,1);
});
test('all board layouts preserve routes for 2–4 players and eight available walls',()=>{
  for(const layout of ['Open','Crossroads','Switchback']) for(const count of [2,3,4]) {
    const g=createGame(count,true,layout);assert.ok(isGame(g));assert.equal(g.turn,0);assert.equal(g.moves,0);
    assert.ok(g.players.every(p=>p.walls===8&&route(p.position,g.walls,g.goal)));
    assert.equal(g.walls.length,layout==='Open'?0:layout==='Crossroads'?5:7);
    const existing=[];
    for(const w of g.walls){assert.equal(wallError({...g,walls:existing,turn:w.owner},w),null);existing.push(w);}
  }
});

