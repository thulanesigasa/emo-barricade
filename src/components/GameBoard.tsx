import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Game, Point, SIZE, Wall, same } from '../engine';

const yellow = '#ffc928';
export function GameBoard({ game, width, disabled, onMove, onWall }: {
  game: Game; width: number; disabled: boolean;
  onMove: (point: Point) => void; onWall: (wall: Wall) => void;
}) {
  const unit = width / SIZE;
  const gap = Math.min(10, unit * 0.32);
  return <View style={{ width, height: width, alignSelf: 'center' }} accessibilityLabel="11 by 11 game board. Tap squares to move, or gaps to place barricades.">
    {Array.from({ length: SIZE * SIZE }, (_, index) => {
      const r = Math.floor(index / SIZE), c = index % SIZE;
      const player = game.players.findIndex(p => same(p.position, { r, c }));
      const goal = same(game.goal, { r, c });
      return <Pressable key={'cell-' + index} accessibilityRole="button"
        accessibilityLabel={`Row ${r + 1}, column ${c + 1}${player >= 0 ? ', ' + game.players[player].name : ''}${goal ? ', gold goal' : ''}`}
        disabled={disabled} onPress={() => onMove({ r, c })}
        style={[s.cell, { left: c * unit + gap / 2, top: r * unit + gap / 2, width: unit - gap, height: unit - gap }, goal && s.goal]}>
        {player >= 0 ? <View style={[s.pawn, { width: unit * 0.57, height: unit * 0.57, backgroundColor: player === game.turn ? yellow : '#fff' }]}><Text style={{ color: '#000', fontSize: Math.max(10, unit * 0.3), fontWeight: '900' }}>{player + 1}</Text></View>
          : goal ? <Text style={{ color: '#000', fontSize: unit * 0.48, fontWeight: '900' }}>★</Text> : null}
      </Pressable>;
    })}
    {(['h', 'v'] as const).flatMap(direction => Array.from({ length: SIZE * (SIZE - 1) }, (_, index) => {
      const boundary = Math.floor(index / SIZE), segment = index % SIZE;
      const horizontal = direction === 'h';
      const r = horizontal ? boundary : Math.min(segment, SIZE - 2);
      const c = horizontal ? Math.min(segment, SIZE - 2) : boundary;
      return <Pressable key={direction + index} accessibilityRole="button"
        accessibilityLabel={`Place ${horizontal ? 'horizontal' : 'vertical'} barricade at row ${r + 1}, column ${c + 1}`}
        disabled={disabled} onPress={() => onWall({ r, c, direction, owner: game.turn })}
        style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center',
          left: horizontal ? segment * unit + gap / 2 : (boundary + 1) * unit - gap / 2,
          top: horizontal ? (boundary + 1) * unit - gap / 2 : segment * unit + gap / 2,
          width: horizontal ? unit - gap : gap, height: horizontal ? gap : unit - gap }}>
        <View pointerEvents="none" style={{ width: horizontal ? '100%' : 1, height: horizontal ? 1 : '100%', backgroundColor: '#ffffff40' }} />
      </Pressable>;
    }))}
    {game.walls.map((wall, index) => {
      const horizontal = wall.direction === 'h';
      return <View key={'wall-' + index} pointerEvents="none" style={{
        position: 'absolute', backgroundColor: yellow,
        left: horizontal ? wall.c * unit + gap / 2 : (wall.c + 1) * unit - 2,
        top: horizontal ? (wall.r + 1) * unit - 2 : wall.r * unit + gap / 2,
        width: horizontal ? unit * 2 - gap : 4, height: horizontal ? 4 : unit * 2 - gap,
      }} />;
    })}
  </View>;
}
const s = StyleSheet.create({
  cell: { position: 'absolute', borderWidth: 1, borderColor: '#ffffff70', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  goal: { backgroundColor: yellow, borderColor: yellow },
  pawn: { borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
});
