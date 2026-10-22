import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import ts from 'typescript';
import { createGame, applyAction, wallError } from '../src/engine.ts';

const source = fs.readFileSync(new URL('../src/components/GameBoard.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
const createElement = (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) });
const exports = {};
vm.runInNewContext(compiled, { exports, require(name) {
  if (name === 'react') return { createElement };
  if (name === 'react-native') return { Pressable: 'Pressable', View: 'View', Text: 'Text', StyleSheet: { create: value => value } };
  if (name === '../engine') return { SIZE: 11, same: (a, b) => a.r === b.r && a.c === b.c };
  throw new Error(name);
}});
function buttons(node) {
  return [ ...(node?.type === 'Pressable' ? [node] : []), ...(node?.children ?? []).flatMap(buttons) ];
}

test('one tap on either gap orientation places a wall and spends one turn', () => {
  for (const direction of ['horizontal', 'vertical']) {
    let game = createGame(2, false);
    const initial = game;
    const board = exports.GameBoard({ game, width: 324, disabled: false, onMove() { assert.fail('Gap triggered pawn move'); }, onWall(wall) {
      assert.equal(wallError(game, wall), null);
      game = applyAction(game, { type: 'wall', wall });
    } });
    const gap = buttons(board).find(b => b.props.accessibilityLabel === 'Place ' + direction + ' barricade at row 1, column 1');
    assert.ok(gap);
    gap.props.onPress();
    assert.equal(game.walls.length, 1);
    assert.equal(game.walls[0].direction, direction === 'horizontal' ? 'h' : 'v');
    assert.equal(game.players[0].walls, initial.players[0].walls - 1);
    assert.equal(game.turn, 1);
    assert.equal(game.moves, 1);
  }
});

test('square taps stay pawn actions; edge slots remain on board and lock during computer turns', () => {
  const game = createGame(2, false);
  for (const width of [284, 324, 520]) {
    let moved;
    const board = exports.GameBoard({ game, width, disabled: true, onMove: point => { moved = point; }, onWall() { assert.fail('Square triggered wall'); } });
    const controls = buttons(board);
    assert.ok(controls.every(b => b.props.disabled));
    const square = controls.find(b => b.props.accessibilityLabel.startsWith('Row 1, column 1'));
    square.props.onPress();
    assert.equal(moved.r, 0); assert.equal(moved.c, 0);
    for (const gap of controls.filter(b => b.props.accessibilityLabel.startsWith('Place '))) {
      const rect = gap.props.style;
      assert.ok(rect.left >= 0 && rect.top >= 0);
      assert.ok(rect.width > 0 && rect.height > 0);
      assert.ok(rect.left + rect.width <= width && rect.top + rect.height <= width);
    }
  }
});
