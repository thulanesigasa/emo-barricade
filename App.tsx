import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Action, COLORS, Game, Point, SIZE, Wall, applyAction, botAction, createGame, isGame, legalMoves, same, wallError } from './src/engine';

const KEY = 'barricade.v1.match';
const PREFS = 'barricade.v1.preferences';
const yellow = '#ffc928';
type Screen = 'home' | 'game' | 'rules' | 'settings';
function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondaryButton, (pressed || disabled) && { opacity: 0.5 }]}><Text style={[s.buttonText, secondary && { color: '#fff' }]}>{title}</Text></Pressable>;
}
function Content() {
  const [screen, setScreen] = useState<Screen>('home');
  const [game, setGame] = useState<Game | null>(null);
  const [ready, setReady] = useState(false);
  const [players, setPlayers] = useState(2);
  const [bots, setBots] = useState(true);
  const [hints, setHints] = useState(true);
  const [tactical, setTactical] = useState(true);
  const [mode, setMode] = useState<'move' | 'h' | 'v'>('move');
  const [candidate, setCandidate] = useState<Wall | null>(null);
  const [notice, setNotice] = useState('');
  const [paused, setPaused] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [foreground, setForeground] = useState(true);
  const saveQueue = useRef(Promise.resolve());
  const dimensions = useWindowDimensions();
  const boardWidth = Math.min(dimensions.width - 36, 520);
  const unit = boardWidth / SIZE;
  useEffect(() => {
    let live = true;
    Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(PREFS)]).then(([match, preferences]) => {
      if (!live) return;
      if (match) { try { const parsed: unknown = JSON.parse(match); if (isGame(parsed)) { setGame(parsed); setPlayers(parsed.players.length); setBots(parsed.players.some(p => p.bot)); } else setNotice('Your saved match could not be restored. Start a new game.'); } catch { setNotice('Your saved match could not be restored. Start a new game.'); } }
      if (preferences) { try { const p = JSON.parse(preferences); setHints(p.hints !== false); setTactical(p.tactical !== false); } catch { /* Use defaults. */ } }
    }).catch(() => { if (live) setNotice('Storage is unavailable. You can still play this session.'); }).finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!ready || !game) return;
    const snapshot = JSON.stringify(game);
    saveQueue.current = saveQueue.current.then(() => AsyncStorage.setItem(KEY, snapshot)).catch(() => setNotice('Could not save this match. Keep the app open to continue.'));
  }, [game, ready]);
  useEffect(() => { if (ready) AsyncStorage.setItem(PREFS, JSON.stringify({ hints, tactical })).catch(() => setNotice('Could not save settings.')); }, [hints, tactical, ready]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { setForeground(state === 'active'); if (state !== 'active') setPaused(true); });
    return () => sub.remove();
  }, []);
  const computer = !!game?.players[game.turn].bot;
  useEffect(() => {
    if (screen !== 'game' || !game || game.winner !== null || !computer || paused || !foreground) return;
    const timeout = setTimeout(() => { setGame(current => current === game ? applyAction(current, botAction(current, tactical)) : current); setCandidate(null); setMode('move'); }, 650);
    return () => clearTimeout(timeout);
  }, [game, computer, screen, paused, tactical, foreground]);
  useEffect(() => { if (game && screen === 'game') AccessibilityInfo.announceForAccessibility(game.winner !== null ? game.log : `${game.players[game.turn].name}'s turn`); }, [game, screen]);
  function start() { setGame(createGame(players, bots)); setScreen('game'); setMode('move'); setCandidate(null); setNotice(''); setPaused(false); setConfirmNew(false); }
  function submit(action: Action) {
    if (!game || computer || paused) return;
    setGame(current => current === game ? applyAction(current, action) : current); setCandidate(null); setMode('move'); setNotice('');
  }
  function tap(p: Point) {
    if (!game || computer || game.winner !== null || paused) return;
    if (mode === 'move') {
      if (legalMoves(game).some(x => same(x, p))) submit({ type: 'move', to: p });
      else setNotice('Tap a highlighted square, or choose a barricade.');
    } else {
      const wall: Wall = { ...p, direction: mode, owner: game.turn };
      setCandidate(wall); setNotice(wallError(game, wall) ?? 'Tap Place barricade to confirm.');
    }
  }
  async function checkUpdates() {
    if (updating) return;
    if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) { setNotice('App updates are available in the installed Android build.'); return; }
    setUpdating(true); setNotice('Checking for an update…');
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) { setNotice('You have the latest compatible update.'); return; }
      await Updates.fetchUpdateAsync();
      Alert.alert('Update ready', 'Your match is saved. Restart to apply the update?', [{ text: 'Later' }, { text: 'Restart', onPress: () => { saveQueue.current.then(() => Updates.reloadAsync()).catch(() => setNotice('Could not restart. Close and reopen the app.')); } }]);
      setNotice('Update downloaded. Restart the app when you are ready.');
    } catch { setNotice('Could not check for updates. Try again when you have internet.'); }
    finally { setUpdating(false); }
  }
  const active = game?.players[game.turn];
  const valid = game && game.winner === null ? legalMoves(game) : [];
  const candidateError = game && candidate ? wallError(game, candidate) : null;
  function wallView(w: Wall, preview = false) {
    const horizontal = w.direction === 'h';
    if (w.r < 0 || w.r > 9 || w.c < 0 || w.c > 9) return null;
    return <View pointerEvents="none" key={`${preview ? 'preview' : 'wall'}-${w.r}-${w.c}-${w.direction}`} style={{ position: 'absolute', left: horizontal ? w.c * unit + 3 : (w.c + 1) * unit - 3, top: horizontal ? (w.r + 1) * unit - 3 : w.r * unit + 3, width: horizontal ? unit * 2 - 6 : 6, height: horizontal ? 6 : unit * 2 - 6, backgroundColor: preview && candidateError ? '#ff4c78' : game?.players[w.owner].color, borderRadius: 4, opacity: preview ? 0.65 : 1, borderWidth: 1, borderColor: preview ? '#fff' : '#ffffff70' }} />;
  }
  return <SafeAreaView style={s.safe}>
    <StatusBar style="light" />
    <View style={s.topbar}>
      <Pressable accessibilityRole="button" accessibilityLabel={screen === 'home' ? 'Barricade home' : 'Back to home'} onPress={() => { setScreen('home'); setCandidate(null); setNotice(''); }}><Text style={s.brand}>{screen === 'home' ? 'B /' : '‹'} <Text style={s.brandSmall}>BARRICADE</Text></Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={screen === 'game' ? 'Pause game' : 'Settings'} onPress={() => { setNotice(''); screen === 'game' ? setPaused(true) : setScreen('settings'); }} style={s.iconButton}><Text style={{ color: '#fff', fontSize: 19 }}>{screen === 'game' ? 'Ⅱ' : '⚙'}</Text></Pressable>
    </View>
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {screen === 'home' && <>
        <View style={s.logoFrame}><Image source={require('./assets/icon.png')} style={s.logo} resizeMode="contain" accessibilityLabel="Barricade logo" /></View>
        <Text style={s.eyebrow}>A GAME OF PATHS & POSSIBILITIES</Text>
        <Text style={s.hero}>One move.{'\n'}Everything changes.</Text>
        <Text style={s.subtitle}>Race to the gold edge. Block their path.{'\n'}Keep your way out.</Text>
        <View style={s.card}>
          <View style={s.row}><Text style={s.section}>SET YOUR TABLE</Text><Text style={s.muted}>OFFLINE • ON DEVICE</Text></View>
          <Text style={s.label}>PLAY WITH</Text>
          <View style={s.row}>{[true, false].map((value, i) => <Pressable accessibilityRole="button" accessibilityState={{ selected: bots === value }} key={i} onPress={() => setBots(value)} style={[s.choice, bots === value && s.choiceActive]}><Text style={[s.choiceText, bots === value && { color: yellow }]}>{value ? 'Computer' : 'Pass & play'}</Text></Pressable>)}</View>
          <Text style={s.label}>PLAYERS</Text>
          <View style={s.row}>{[2, 3, 4].map(count => <Pressable accessibilityRole="button" accessibilityLabel={`${count} players`} accessibilityState={{ selected: players === count }} key={count} onPress={() => setPlayers(count)} style={[s.choice, players === count && s.choiceActive]}><Text style={[s.choiceText, players === count && { color: yellow }]}>{count}</Text></Pressable>)}</View>
          <Button title="Start a match  ↗" disabled={!ready} onPress={() => game && game.winner === null ? setConfirmNew(true) : start()} />
          {game && game.winner === null && <Button secondary title="Continue your match" onPress={() => { setScreen('game'); setPaused(false); setNotice(''); }} />}
        </View>
        <Pressable accessibilityRole="button" onPress={() => { setScreen('rules'); setNotice(''); }}><Text style={s.link}>New here? Learn how to play →</Text></Pressable>
        <Text style={s.footer}>NO ACCOUNT. NO CONNECTION. JUST STRATEGY.</Text>
      </>}
      {screen === 'game' && game && <>
        <View style={s.row}><View style={{ flex: 1 }}><Text style={s.eyebrow}>THE RACE IS ON</Text><Text style={s.heading}>{game.winner !== null ? `${game.players[game.winner].name} won!` : computer ? `${active?.name} is thinking…` : `${active?.name}'s move`}</Text></View><View style={s.roundBadge}><Text style={s.muted}>TURN</Text><Text style={s.turnNumber}>{game.moves + (game.winner === null ? 1 : 0)}</Text></View></View>
        <View style={s.players}>{game.players.map((p, i) => <View key={i} style={[s.player, i === game.turn && { borderColor: p.color }]}><View style={[s.dot, { backgroundColor: p.color }]} /><Text style={s.playerName}>{p.name}</Text><Text style={s.muted}>{p.walls} walls</Text></View>)}</View>
        <View style={s.boardCard}>
          <Text style={s.goal}>↑  GOLD EDGE • FIRST TO REACH IT WINS  ↑</Text>
          <View style={{ width: boardWidth, height: boardWidth, alignSelf: 'center' }} accessibilityLabel="11 by 11 game board">
            {Array.from({ length: SIZE }, (_, r) => <View key={r} style={{ flexDirection: 'row' }}>{Array.from({ length: SIZE }, (_, c) => {
              const pawn = game.players.find(p => same(p.position, { r, c }));
              const canMove = mode === 'move' && !computer && game.winner === null && valid.some(p => same(p, { r, c }));
              return <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Row ${r + 1}, column ${c + 1}${pawn ? `, ${pawn.name}` : ''}${canMove ? ', available move' : ''}${r === 0 ? ', gold edge' : ''}`} disabled={computer || game.winner !== null || paused} onPress={() => tap({ r, c })} style={{ width: unit, height: unit, padding: 2 }}><View style={[s.cell, r === 0 && s.goldCell, canMove && hints && { borderColor: active?.color, backgroundColor: '#18303a' }]}>{pawn ? <View style={[s.pawn, { backgroundColor: pawn.color, width: unit * 0.57, height: unit * 0.57 }]}><Text style={{ color: '#071017', fontSize: Math.max(10, unit * 0.28), fontWeight: '900' }}>{game.players.indexOf(pawn) + 1}</Text></View> : canMove && hints ? <View style={[s.moveDot, { backgroundColor: active?.color }]} /> : null}</View></Pressable>;
            })}</View>)}
            {game.walls.map(w => wallView(w))}{candidate && wallView(candidate, true)}
          </View>
        </View>
        {game.winner === null ? <View style={s.card}>
          <Text style={s.section}>{computer ? 'PLANNING THE NEXT MOVE' : 'YOUR MOVE, YOUR STRATEGY'}</Text>
          <View style={[s.row, { marginTop: 14 }]}>{(['move', 'h', 'v'] as const).map((value, i) => <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === value, disabled: computer }} disabled={computer} key={value} onPress={() => { setMode(value); setCandidate(null); setNotice(''); }} style={[s.choice, mode === value && s.choiceActive]}><Text style={[s.choiceText, mode === value && { color: yellow }]}>{['● Move', '━ Wall', '┃ Wall'][i]}</Text></Pressable>)}</View>
          <Text style={s.hint}>{mode === 'move' ? 'Tap a neighbouring square to move your pawn.' : 'Tap the top-left square of a 2 × 2 area to preview a wall, then confirm.'}</Text>
          {valid.length === 0 && !computer && <Button secondary title="No pawn move — pass turn" onPress={() => submit({ type: 'pass' })} />}
          {candidate && <Button title="Place barricade" disabled={!!candidateError || computer} onPress={() => submit({ type: 'wall', wall: candidate })} />}
        </View> : <View style={s.card}><Text style={s.heading}>Path conquered.</Text><Text style={s.subtitle}>A well-played race. Ready for a rematch?</Text><Button title="Play again ↗" onPress={start} /><Button secondary title="Back to home" onPress={() => setScreen('home')} /></View>}
        <Text style={s.activity}>{game.log}</Text>
      </>}
      {screen === 'rules' && <>
        <Text style={s.eyebrow}>THE PLAYBOOK</Text><Text style={s.hero}>Simple rules.{'\n'}Clever decisions.</Text>
        {[
          ['01', 'Chase the gold', 'All players start along the bottom of the 11 × 11 board. Reach any gold square on the top edge first to win.'],
          ['02', 'Move or barricade', 'On your turn, move one square up, down, left or right — or place one of your eight barricades. A barricade covers two square edges.'],
          ['03', 'Find another way', 'Walls cannot overlap or cross. Every player must always have a route to the gold edge. Illegal placements are rejected before your turn is spent.'],
          ['04', 'Jump ahead', 'If a pawn is directly beside you, jump over it when the next square is free. If a wall, edge or another pawn stops the jump, step around it diagonally.'],
          ['05', 'Play anywhere', 'Choose 2–4 players. Computer mode gives you computer opponents; Pass & play lets everyone share one device. Matches save after every turn. If other pawns leave you without a legal pawn move, you can pass your turn.']
        ].map(([number, title, body]) => <View key={number} style={s.rule}><Text style={s.ruleNumber}>{number}</Text><View style={{ flex: 1 }}><Text style={s.ruleTitle}>{title}</Text><Text style={s.body}>{body}</Text></View></View>)}
        <Button title={game && game.winner === null ? 'Return to match' : 'Let’s play ↗'} onPress={() => { if (game && game.winner === null) { setScreen('game'); setPaused(false); } else setScreen('home'); }} />
      </>}
      {screen === 'settings' && <>
        <Text style={s.eyebrow}>MAKE IT YOUR GAME</Text><Text style={s.hero}>The small details.</Text>
        <View style={s.card}><Text style={s.ruleTitle}>Move hints</Text><Text style={s.body}>Highlight squares your pawn can reach.</Text><Button secondary title={hints ? 'Hints: On' : 'Hints: Off'} onPress={() => setHints(!hints)} /></View>
        <View style={s.card}><Text style={s.ruleTitle}>Computer strategy</Text><Text style={s.body}>{tactical ? 'Tactical opponents move and place walls to slow you down.' : 'Relaxed opponents focus on finding their shortest route.'}</Text><Button secondary title={tactical ? 'Difficulty: Tactical' : 'Difficulty: Relaxed'} onPress={() => setTactical(!tactical)} /></View>
        <View style={s.card}><Text style={s.ruleTitle}>App updates</Text><Text style={s.body}>Version 1.0.1 • Compatible updates: 1.0.1{ '\n' }Your game works offline. Connect only to download an update.</Text><Button secondary disabled={updating} title={updating ? 'Checking…' : 'Check for updates'} onPress={checkUpdates} /></View>
        <Text style={s.footer}>BARRICADE • BUILT TO MAKE YOU THINK</Text>
      </>}
      {!!notice && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text>}
    </ScrollView>
    <Modal transparent visible={paused && screen === 'game'} animationType="fade" onRequestClose={() => setPaused(false)}><View style={s.overlay}><View style={s.modal}><Text style={s.eyebrow}>TAKE A BREATHER</Text><Text style={s.heading}>Your next move can wait.</Text><Text style={s.body}>Your match is saved on this device.</Text><Button title="Resume match" onPress={() => setPaused(false)} /><Button secondary title="How to play" onPress={() => { setPaused(false); setScreen('rules'); }} /><Button secondary title="Leave to home" onPress={() => { setPaused(false); setScreen('home'); }} /></View></View></Modal>
    <Modal transparent visible={confirmNew} animationType="fade" onRequestClose={() => setConfirmNew(false)}><View style={s.overlay}><View style={s.modal}><Text style={s.heading}>Start a fresh match?</Text><Text style={s.body}>This replaces your unfinished saved match.</Text><Button title="Start new match" onPress={start} /><Button secondary title="Keep my match" onPress={() => setConfirmNew(false)} /></View></View></Modal>
  </SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><Content /></SafeAreaProvider>; }
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07090d' }, topbar: { width: '100%', maxWidth: 580, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#1c232d' }, brand: { color: yellow, fontSize: 24, fontWeight: '900' }, brandSmall: { color: '#fff', fontSize: 14, letterSpacing: 2 }, iconButton: { width: 44, height: 44, backgroundColor: '#161c25', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 18, paddingBottom: 40, width: '100%', maxWidth: 560, alignSelf: 'center' }, logoFrame: { height: 150, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', borderRadius: 22, overflow: 'hidden', marginBottom: 24 }, logo: { width: 330, height: 330 }, eyebrow: { color: yellow, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 12 }, hero: { color: '#f8f9fb', fontSize: 36, fontWeight: '900', letterSpacing: -1.2, lineHeight: 40, marginBottom: 14 }, subtitle: { color: '#a5afbf', fontSize: 15, lineHeight: 23, marginBottom: 20 }, card: { backgroundColor: '#111720', borderWidth: 1, borderColor: '#26303e', borderRadius: 20, padding: 18, marginBottom: 16 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, section: { color: '#dce3ed', fontSize: 10, fontWeight: '800', letterSpacing: 1.3, flexShrink: 1 }, muted: { color: '#8a98ad', fontSize: 9, fontWeight: '700' }, label: { fontSize: 10, color: '#8592a6', letterSpacing: 1.5, fontWeight: '700', marginTop: 22, marginBottom: 9 }, choice: { flex: 1, borderWidth: 1, borderColor: '#2a3546', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }, choiceActive: { backgroundColor: '#282414', borderColor: '#8e7427' }, choiceText: { color: '#b3bed0', fontSize: 13, fontWeight: '700' }, button: { minHeight: 50, paddingHorizontal: 15, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: yellow, marginTop: 14 }, secondaryButton: { backgroundColor: '#1c2532', borderWidth: 1, borderColor: '#354154' }, buttonText: { color: '#11151a', fontSize: 15, fontWeight: '800' }, link: { color: '#d8e0eb', fontSize: 13, textAlign: 'center', paddingVertical: 15 }, footer: { color: '#56657a', fontSize: 9, fontWeight: '700', letterSpacing: 1.2, textAlign: 'center', marginTop: 18 }, heading: { color: '#fff', fontWeight: '800', fontSize: 24, letterSpacing: -0.5, marginBottom: 8 }, roundBadge: { backgroundColor: '#18212d', padding: 12, borderRadius: 14, alignItems: 'center', minWidth: 56 }, turnNumber: { color: '#fff', fontSize: 20, fontWeight: '800' }, players: { flexDirection: 'row', gap: 6, marginVertical: 18 }, player: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: '#273040', backgroundColor: '#101720', padding: 10, gap: 5 }, playerName: { color: '#fff', fontSize: 11, fontWeight: '700' }, dot: { width: 9, height: 9, borderRadius: 5 }, boardCard: { marginBottom: 18 }, goal: { color: yellow, fontSize: 9, fontWeight: '800', letterSpacing: 1, textAlign: 'center', marginBottom: 10 }, cell: { flex: 1, backgroundColor: '#101923', borderWidth: 1, borderColor: '#253141', borderRadius: 4, justifyContent: 'center', alignItems: 'center' }, goldCell: { backgroundColor: '#e8b70d', borderColor: '#ffe27c' }, pawn: { borderRadius: 100, borderWidth: 2, borderColor: '#ffffff50', justifyContent: 'center', alignItems: 'center' }, moveDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.8 }, hint: { color: '#8f9eb3', fontSize: 12, lineHeight: 18, marginTop: 12 }, activity: { color: '#8593a8', fontSize: 12, textAlign: 'center', marginTop: 5 }, notice: { color: '#ffe08c', backgroundColor: '#272312', padding: 14, lineHeight: 21, borderRadius: 12, marginTop: 16, fontSize: 13 }, rule: { flexDirection: 'row', gap: 16, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#232d3b' }, ruleNumber: { color: yellow, fontSize: 16, fontWeight: '800' }, ruleTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 }, body: { color: '#9ba9bd', fontSize: 14, lineHeight: 23 }, overlay: { flex: 1, backgroundColor: '#000c', alignItems: 'center', justifyContent: 'center', padding: 24 }, modal: { width: '100%', maxWidth: 420, backgroundColor: '#151d29', borderColor: '#344157', borderWidth: 1, borderRadius: 24, padding: 24 }
});
