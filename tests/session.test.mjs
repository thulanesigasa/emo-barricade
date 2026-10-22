import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame,botAction,legalMoves } from '../src/engine.ts';
import { playTurn,undoTurn,restoreSession } from '../src/session.ts';
test('undo restores a full human turn including every computer response',()=>{
  const original={game:createGame(4,true,'Crossroads'),undo:[]};
  let s=playTurn(original,{type:'move',to:legalMoves(original.game)[0]});
  while(s.game.turn!==0&&s.game.winner===null) s=playTurn(s,botAction(s.game),false);
  assert.equal(s.undo.length,1);assert.deepEqual(undoTurn(s),original);
  assert.deepEqual(undoTurn(restoreSession(JSON.parse(JSON.stringify(s)))),original);
});
test('invalid actions do not create undo snapshots and empty undo is safe',()=>{
  const s={game:createGame(),undo:[]};
  assert.equal(playTurn(s,{type:'move',to:{r:0,c:0}}),s);assert.equal(undoTurn(s),s);
});
test('old saved matches migrate and corrupted undo history is discarded',()=>{
  const game=createGame();assert.deepEqual(restoreSession(game),{game,undo:[]});
  assert.deepEqual(restoreSession({game,undo:[null]}),{game,undo:[]});assert.equal(restoreSession({game:{}}),null);
});
test('pass-and-play undo restores the immediately previous turn',()=>{
  const original={game:createGame(2,false),undo:[]};
  const s=playTurn(original,{type:'move',to:legalMoves(original.game)[0]});
  assert.deepEqual(undoTurn(s),original);
});
test('suggestions never mutate a match and always produce a legal action',()=>{
  for(const layout of ['Open','Crossroads','Switchback']){
    const game=createGame(4,true,layout),before=JSON.stringify(game),action=botAction(game);
    assert.equal(JSON.stringify(game),before);assert.notEqual(playTurn({game,undo:[]},action).game,game);
  }
});
