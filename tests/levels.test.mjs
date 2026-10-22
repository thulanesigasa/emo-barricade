import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_COUNT, LAYOUTS, createGame, route, isGame, wallError, applyAction, botAction, same } from '../src/engine.ts';
import { isUnlocked, recordCompletion, restoreProgress } from '../src/progression.ts';
import { restoreSession } from '../src/session.ts';
test('every level/layout/player count has one reachable goal, equally distant separated spawns',()=>{
  const goals=new Set(), spawns=new Set();
  for(let level=1;level<=LEVEL_COUNT;level++) for(const layout of LAYOUTS) for(const count of [2,3,4]){
    const g=createGame(count,true,layout,level);assert.ok(isGame(g),`${level}/${layout}/${count}`);
    const distances=g.players.map(p=>route(p.position,g.walls,g.goal).length-1);
    assert.ok(distances.every(d=>d===g.startDistance&&d>=6));assert.equal(g.turn,(level-1)%count);
    for(let i=0;i<count;i++)for(let j=i+1;j<count;j++)assert.ok(Math.abs(g.players[i].position.r-g.players[j].position.r)+Math.abs(g.players[i].position.c-g.players[j].position.c)>=4);
    assert.ok(g.players.every(p=>!same(p.position,g.goal)&&p.walls===8));
    goals.add(JSON.stringify(g.goal));g.players.forEach(p=>spawns.add(JSON.stringify(p.position)));
  }
  assert.equal(goals.size,LEVEL_COUNT);assert.ok(spawns.size>20);
});
test('only the exact goal square wins, not other squares on the old gold edge',()=>{
  const g=createGame();g.players[0].position={r:1,c:3};g.players[1].position={r:10,c:10};
  const next=applyAction(g,{type:'move',to:{r:0,c:3}});assert.equal(next.winner,null);
  g.players[0].position={r:g.goal.r+1,c:g.goal.c};
  assert.equal(applyAction(g,{type:'move',to:g.goal}).winner,0);
});
test('walls must preserve a route to the single gold goal',()=>{
  const g=createGame();g.goal={r:0,c:0};g.players[0].position={r:5,c:5};g.players[1].position={r:8,c:8};
  g.walls=[{r:0,c:0,direction:'h',owner:1}];
  assert.match(wallError(g,{r:0,c:1,direction:'v',owner:0}),/route/);
});
test('new levels are deterministic and invalid settings are rejected',()=>{
  assert.deepEqual(createGame(4,true,'Switchback',7),createGame(4,true,'Switchback',7));
  assert.throws(()=>createGame(2,true,'Open',0));assert.throws(()=>createGame(2,true,'Open',13));
});
test('completion unlocks one level, persists, and cannot be farmed or skipped',()=>{
  let p={completed:[]};assert.ok(isUnlocked(p,1));assert.equal(isUnlocked(p,2),false);
  let g=createGame();assert.equal(recordCompletion(p,g),p);
  g.players[0].position={...g.goal};g.winner=0;p=recordCompletion(p,g);
  assert.deepEqual(p.completed,[1]);assert.ok(isUnlocked(p,2));assert.equal(isUnlocked(p,3),false);
  assert.equal(recordCompletion(p,g),p);assert.deepEqual(restoreProgress(JSON.parse(JSON.stringify(p))),p);
  const skip=createGame(2,true,'Open',4);skip.winner=0;assert.equal(recordCompletion(p,skip),p);
});
test('a computer win does not complete a level; pass-and-play human wins do',()=>{
  const p={completed:[]},g=createGame();g.winner=1;assert.equal(recordCompletion(p,g),p);
  const local=createGame(2,false);local.winner=1;local.players[1].position={...local.goal};assert.deepEqual(recordCompletion(p,local).completed,[1]);
});
test('corrupt progress is normalised and campaign ends at the final level',()=>{
  assert.deepEqual(restoreProgress(null),{completed:[]});assert.deepEqual(restoreProgress({completed:[1,1,2,4,99]}),{completed:[1,2]});
  const p={completed:Array.from({length:LEVEL_COUNT},(_,i)=>i+1)};
  assert.equal(isUnlocked(p,LEVEL_COUNT+1),false);
});
test('legacy sessions receive one reachable goal and do not award campaign credit',()=>{
  const old=createGame();delete old.goal;delete old.level;delete old.startDistance;
  const restored=restoreSession({game:old,undo:[]});assert.ok(restored);assert.ok(isGame(restored.game));assert.equal(restored.game.level,undefined);
  const broken={...old,goal:{r:-1,c:0}};assert.equal(restoreSession(broken),null);
});
test('computers can finish single-goal races across all levels',()=>{
  for(let level=1;level<=LEVEL_COUNT;level++)for(const tactical of [false,true]){
    let g=createGame(2,true,level%2?'Open':'Crossroads',level);
    for(let n=0;n<200&&g.winner===null;n++){const next=applyAction(g,botAction(g,tactical));assert.notEqual(next,g);g=next;}
    assert.notEqual(g.winner,null,`level ${level}, tactical ${tactical}`);assert.ok(same(g.players[g.winner].position,g.goal));
  }
});
