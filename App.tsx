import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Alert, Image, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Action, LAYOUTS, LEVEL_COUNT, Layout, Point, Wall, botAction, createGame, legalMoves, route, same, wallError } from './src/engine';

import { Session, playTurn, restoreSession, undoTurn } from './src/session';

import { FloatingTabs, MainTab } from './src/components/FloatingTabs';

import { GameBoard } from './src/components/GameBoard';

import { Progress, isUnlocked, recordCompletion, restoreProgress } from './src/progression';

const PROGRESS = 'barricade.v1.levels';
const KEY = 'barricade.v1.match';
const PREFS = 'barricade.v1.preferences';
const yellow = '#ffc928';
type Screen = 'home' | 'play' | 'game' | 'profile' | 'rules';
function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondaryButton, (pressed || disabled) && { opacity: 0.5 }]}><Text style={[s.buttonText, secondary && { color: '#fff' }]}>{title}</Text></Pressable>;
}
function Content() {
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedTab, setSelectedTab] = useState<MainTab>('Home');
  const [displayName, setDisplayName] = useState('');
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [session, setSession] = useState<Session | null>(null);
  const game = session?.game ?? null;
  const [layout, setLayout] = useState<Layout>('Open');
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [progress, setProgress] = useState<Progress>({ completed: [] });
  const [ready, setReady] = useState(false);
  const [players, setPlayers] = useState(2);
  const [bots, setBots] = useState(true);
  const [tactical, setTactical] = useState(true);
  const [notice, setNotice] = useState('');
  const [paused, setPaused] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [foreground, setForeground] = useState(true);
  const saveQueue = useRef(Promise.resolve());
  const dimensions = useWindowDimensions();
  const boardWidth = Math.min(dimensions.width - 36, 520);
  useEffect(() => {
    let live = true;
    Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(PREFS), AsyncStorage.getItem(PROGRESS)]).then(([match, preferences, savedProgress]) => {
      if (!live) return;
      if (match) { try { const parsed = restoreSession(JSON.parse(match)); if (parsed) { setSession(parsed); setPlayers(parsed.game.players.length); setBots(parsed.game.players.some(p => p.bot)); setLayout(parsed.game.layout ?? 'Open'); } else setNotice('Your saved match could not be restored. Start a new game.'); } catch { setNotice('Your saved match could not be restored. Start a new game.'); } }
      if (savedProgress) { try { const restored = restoreProgress(JSON.parse(savedProgress)); setProgress(restored); setSelectedLevel(Math.min(LEVEL_COUNT, restored.completed.length + 1)); } catch { /* Start at level one. */ } }
      if (preferences) { try { const p = JSON.parse(preferences); setTactical(p.tactical !== false); if (typeof p.displayName === 'string') setDisplayName(p.displayName.slice(0, 24)); } catch { /* Use defaults. */ } }
    }).catch(() => { if (live) setNotice('Storage is unavailable. You can still play this session.'); }).finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!ready || !session) return;
    const snapshot = JSON.stringify(session);
    saveQueue.current = saveQueue.current.then(() => AsyncStorage.setItem(KEY, snapshot)).catch(() => setNotice('Could not save this match. Keep the app open to continue.'));
  }, [session, ready]);
  useEffect(() => {
    if (!ready) return;
    const preferences = JSON.stringify({ tactical, displayName });
    saveQueue.current = saveQueue.current.then(() => AsyncStorage.setItem(PREFS, preferences)).catch(() => setNotice('Could not save settings.'));
  }, [tactical, displayName, ready]);
  useEffect(() => {
    if (ready && game) setProgress(current => recordCompletion(current, game));
  }, [game, ready]);
  useEffect(() => {
    if (!ready) return;
    const snapshot = JSON.stringify(progress);
    saveQueue.current = saveQueue.current.then(() => AsyncStorage.setItem(PROGRESS, snapshot)).catch(() => setNotice('Could not save level progress.'));
  }, [progress, ready]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { setForeground(state === 'active'); if (state !== 'active') setPaused(true); });
    return () => sub.remove();
  }, []);
  const computer = !!game?.players[game.turn].bot;
  useEffect(() => {
    if (screen !== 'game' || !game || game.winner !== null || !computer || paused || !foreground) return;
    const timeout = setTimeout(() => { setSession(current => current?.game === game ? playTurn(current, botAction(game, tactical), false) : current); }, 650);
    return () => clearTimeout(timeout);
  }, [game, computer, screen, paused, tactical, foreground]);
  useEffect(() => { if (game && screen === 'game') AccessibilityInfo.announceForAccessibility(game.winner !== null ? game.log : `${game.players[game.turn].name}'s turn`); }, [game, screen]);
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [screen]);
  function navigateTab(tab: MainTab) {
    Keyboard.dismiss();
    setSelectedTab(tab); setPaused(false); setNotice('');
    setScreen(tab === 'Home' ? 'home' : tab === 'Profile' ? 'profile' : game ? 'game' : 'play');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }
  function openSetup() {
    Keyboard.dismiss();
    setSelectedTab('Play'); setScreen('play'); setPaused(false); setNotice('');
  }
  function beginLevel(level: number) {
    if (!ready || !isUnlocked(progress, level)) return;
    const next = createGame(players, bots, layout, level);
    next.players[0].name = displayName.trim() || 'You';
    setSession({ game: next, undo: [] }); setSelectedLevel(level); setSelectedTab('Play');
    setScreen('game'); setNotice(''); setPaused(false); setConfirmNew(false);
  }
  function start() { beginLevel(selectedLevel); }
  function submit(action: Action) {
    if (!game || computer || paused) return;
    setSession(current => current?.game === game ? playTurn(current, action) : current); setNotice('');
  }
  function undo() {
    if (!session?.undo.length) return;
    setSession(current => current ? undoTurn(current) : current);
    setNotice('Turn undone — including computer responses.');
  }
  function tap(p: Point) {
    if (!game || computer || game.winner !== null || paused) return;
    if (legalMoves(game).some(x => same(x, p))) submit({ type: 'move', to: p });
    else setNotice('Move one square or jump a neighbouring pawn. Tap a gap to place a barricade.');
  }
  function placeWall(wall: Wall) {
    if (!game || computer || game.winner !== null || paused) return;
    const error = wallError(game, wall);
    if (error) { setNotice(error); return; }
    submit({ type: 'wall', wall });
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
  return <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
    <StatusBar style="light" />
    <View style={s.topbar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Barricade home" onPress={() => navigateTab('Home')} style={s.headerLogoFrame}><Image source={require('./assets/icon.png')} style={s.headerLogo} resizeMode="contain" /></Pressable>
      {screen === 'game' && game && game.winner === null && <Pressable accessibilityRole="button" accessibilityLabel="Pause game" onPress={() => { setNotice(''); setPaused(true); }} style={s.pause}><Text style={s.pauseText}>Ⅱ  Pause</Text></Pressable>}
    </View>
    <ScrollView ref={scrollRef} contentContainerStyle={[s.content, { paddingBottom: 112 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      {screen === 'home' && <>
        <View style={s.logoFrame}><Image source={require('./assets/icon.png')} style={s.logo} resizeMode="contain" accessibilityLabel="Barricade logo" /></View>
        <Text style={s.eyebrow}>A GAME OF PATHS & POSSIBILITIES</Text>
        <Text style={s.hero}>One move.{'\n'}Everything changes.</Text>
        <Text style={s.subtitle}>Race to the gold square. Block their path.{'\n'}Keep your way out.</Text>
        <Text style={s.body}>{progress.completed.length} of {LEVEL_COUNT} levels completed</Text>
        <Button title="Choose a level  ↗" disabled={!ready} onPress={openSetup} />
        {game && game.winner === null && <Button secondary title="Continue your match" onPress={() => navigateTab('Play')} />}
        <Pressable accessibilityRole="button" onPress={() => { setScreen('rules'); setNotice(''); }}><Text style={s.link}>New here? Learn how to play →</Text></Pressable>
        <View style={s.sectionBlock}><Text style={s.section}>THINK AHEAD. FIND YOUR WAY.</Text><Text style={s.body}>Choose a board, challenge the computer, or pass the phone between friends. Your match stays with you when you switch tabs.</Text></View>
        <Text style={s.footer}>NO ACCOUNT. NO CONNECTION. JUST STRATEGY.</Text>
      </>}
      {screen === 'play' && <>
        <Text style={s.eyebrow}>PLAY YOUR WAY</Text><Text style={s.hero}>Set your table.</Text>
        <Text style={s.subtitle}>One gold square. Fair starting distances. Win to unlock the next level.</Text>
        <Text style={s.section}>LEVELS • {progress.completed.length} / {LEVEL_COUNT} COMPLETED</Text>
        <View style={s.levelGrid}>{Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1).map(level => {
          const unlocked = isUnlocked(progress, level), completed = progress.completed.includes(level);
          return <Pressable key={level} accessibilityRole="button" accessibilityLabel={`Level ${level}, ${completed ? 'completed' : unlocked ? 'unlocked' : 'locked'}`} accessibilityState={{ selected: selectedLevel === level, disabled: !ready || !unlocked }} disabled={!ready || !unlocked} onPress={() => setSelectedLevel(level)} style={[s.levelChoice, selectedLevel === level && { borderBottomColor: yellow }, !unlocked && { opacity: 0.4 }]}><Text style={[s.choiceText, selectedLevel === level && { color: yellow }]}>Level {level}{completed ? ' ✓' : ''}</Text><Text style={s.muted}>{completed ? 'Completed' : unlocked ? 'Ready to play' : 'Locked'}</Text></Pressable>;
        })}</View>
        <Text style={s.hint}>Every player starts the same number of route steps from the goal, at least four squares apart. Starting turns rotate between levels.</Text>
        <View style={s.sectionBlock}>
          <View style={s.row}><Text style={s.section}>SET YOUR TABLE</Text><Text style={s.muted}>OFFLINE • ON DEVICE</Text></View>
          <Text style={s.label}>PLAY WITH</Text>
          <View style={s.row}>{[true, false].map((value, i) => <Pressable accessibilityRole="button" accessibilityState={{ selected: bots === value }} key={i} onPress={() => setBots(value)} style={[s.choice, bots === value && s.choiceActive]}><Text style={[s.choiceText, bots === value && { color: yellow }]}>{value ? 'Computer' : 'Pass & play'}</Text></Pressable>)}</View>
          <Text style={s.label}>PLAYERS</Text>
          <View style={s.row}>{[2, 3, 4].map(count => <Pressable accessibilityRole="button" accessibilityLabel={`${count} players`} accessibilityState={{ selected: players === count }} key={count} onPress={() => setPlayers(count)} style={[s.choice, players === count && s.choiceActive]}><Text style={[s.choiceText, players === count && { color: yellow }]}>{count}</Text></Pressable>)}</View>
          <Text style={s.label}>BOARD LAYOUT</Text>
          <View style={s.row}>{LAYOUTS.map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: layout === value }} onPress={() => setLayout(value)} style={[s.choice, layout === value && s.choiceActive]}><Text style={[s.choiceText, layout === value && { color: yellow }]}>{value}</Text></Pressable>)}</View>
          <Text style={s.hint}>{layout === 'Open' ? 'A clean board. Build your own obstacles.' : 'Pre-placed barricades create a new route to master. Everyone still has eight walls.'}</Text>
          <Button title={`Start level ${selectedLevel}  ↗`} disabled={!ready} onPress={() => game && game.winner === null ? setConfirmNew(true) : start()} />
          {game && game.winner === null && <Button secondary title="Continue your match" onPress={() => navigateTab('Play')} />}
        </View>
        <Pressable accessibilityRole="button" onPress={() => setScreen('rules')}><Text style={s.link}>Read the playbook →</Text></Pressable>
      </>}
      {screen === 'game' && game && <>
        <View style={s.row}><View style={{ flex: 1 }}><Text style={s.eyebrow}>{game.level ? `LEVEL ${game.level} OF ${LEVEL_COUNT}` : 'PRACTICE MATCH'}</Text><Text style={s.heading}>{game.winner !== null ? `${game.players[game.winner].name} won!` : computer ? `${active?.name} is thinking…` : active?.name === 'You' ? 'Your move.' : `${active?.name}'s move`}</Text></View><View style={s.roundBadge}><Text style={s.muted}>TURN</Text><Text style={s.turnNumber}>{game.moves + (game.winner === null ? 1 : 0)}</Text></View></View>
        <View style={s.players}>{game.players.map((p, i) => <View key={i} style={[s.player, i === game.turn && { borderBottomColor: yellow }]}><Text style={[s.playerIndex, { color: i === game.turn ? yellow : '#fff' }]}>{String(i + 1).padStart(2, '0')}</Text><Text style={s.playerName}>{p.name}</Text><Text style={s.muted}>{p.walls} walls</Text><Text style={s.muted}>{(route(p.position, game.walls, game.goal)?.length ?? 1) - 1} goal steps</Text></View>)}</View>
        {!!notice && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text>}
        <View style={s.boardCard}>
          <Text style={s.goal}>ONE GOLD SQUARE • FIRST TO REACH IT WINS</Text>
          <GameBoard game={game} width={boardWidth} disabled={computer || game.winner !== null || paused} onMove={tap} onWall={placeWall} />
        </View>
        {game.winner === null ? <View style={s.sectionBlock}>
          <Text style={s.section}>{computer ? 'PLANNING THE NEXT MOVE' : 'TAP A SQUARE. OR BUILD A BARRICADE.'}</Text>
          <Text style={s.hint}>Tap a square to move. Tap a horizontal or vertical gap to place a two-square barricade immediately.</Text>
          <View style={s.row}><Pressable accessibilityRole="button" disabled={computer || !session?.undo.length} onPress={undo} style={{ paddingVertical: 16, opacity: computer || !session?.undo.length ? 0.4 : 1 }}><Text style={{ color: yellow, fontWeight: '800' }}>↶ Undo turn</Text></Pressable></View>
          {valid.length === 0 && !computer && <Button secondary title="No pawn move — pass turn" onPress={() => submit({ type: 'pass' })} />}
        </View> : <View style={s.sectionBlock}><Text style={s.heading}>{game.players[game.winner].bot ? 'Try another strategy.' : game.level ? `Level ${game.level} complete!` : 'Path conquered.'}</Text><Text style={s.subtitle}>{game.players[game.winner].bot ? 'The computer reached the gold first. Retry to unlock the next level.' : game.level ? 'You reached the goal. Your completion is saved on this device.' : 'Practice match completed. Choose a level to begin the campaign.'}</Text>{game.level && game.level < LEVEL_COUNT && isUnlocked(progress, game.level + 1) ? <Button title={`Next level: ${game.level + 1} →`} onPress={() => beginLevel(game.level! + 1)} /> : null}{progress.completed.length === LEVEL_COUNT && <Text style={s.body}>All {LEVEL_COUNT} levels completed!</Text>}<Button title="Replay level" onPress={() => beginLevel(game.level ?? selectedLevel)} /><Button secondary title="Undo final turn" disabled={!session?.undo.length} onPress={undo} /><Button secondary title="Back to home" onPress={() => navigateTab('Home')} /></View>}
        <Text style={s.activity}>{game.log}</Text>
      </>}
      {screen === 'rules' && <>
        <Text style={s.eyebrow}>THE PLAYBOOK</Text><Text style={s.hero}>Simple rules.{'\n'}Clever decisions.</Text>
        {[
          ['01', 'Chase the gold', 'Reach the one gold square marked with a star. Each level moves the goal and starting positions. New levels give every player equal shortest-route distances through the walls and keep starting pawns separated.'],
          ['02', 'Move or barricade', 'On your turn, move one square up, down, left or right — or place one of your eight barricades. Tap a horizontal gap for a horizontal barricade, or a vertical gap for a vertical one. It is placed immediately and covers two square edges. Use Undo to take back your turn.'],
          ['03', 'Find another way', 'Walls cannot overlap or cross. Every player must always have a route to the single gold square. Illegal placements are rejected before your turn is spent.'],
          ['04', 'Jump ahead', 'If a pawn is directly beside you, jump over it when the next square is free. If a wall, edge or another pawn stops the jump, step around it diagonally.'],
          ['05', 'Practice your strategy', 'Win a level to unlock the next one. In computer mode, you must beat the computer; in pass & play, a human winner completes the level for this device. Open, Crossroads and Switchback add variety. Undo is saved with your match.'],
          ['06', 'Play anywhere', 'Choose 2–4 players. Computer mode gives you computer opponents; Pass & play lets everyone share one device. Matches save after every turn. If other pawns leave you without a legal pawn move, you can pass your turn.']
        ].map(([number, title, body]) => <View key={number} style={s.rule}><Text style={s.ruleNumber}>{number}</Text><View style={{ flex: 1 }}><Text style={s.ruleTitle}>{title}</Text><Text style={s.body}>{body}</Text></View></View>)}
        <Button title={game && game.winner === null ? 'Return to match' : 'Let’s play ↗'} onPress={() => { if (game && game.winner === null) { navigateTab('Play'); } else openSetup(); }} />
      </>}
      {screen === 'profile' && <>
        <Text style={s.eyebrow}>YOUR CORNER</Text>
        <View style={s.profileHeader}><View style={s.avatar}><Text style={s.avatarText}>{displayName.trim().slice(0, 1).toUpperCase() || 'B'}</Text></View><View style={{ flex: 1 }}><Text style={s.heading}>{displayName.trim() || 'Barricade player'}</Text><Text style={s.body}>Your game, on this device.</Text></View></View>
        <View style={s.sectionBlock}><Text style={s.label}>PLAYER NAME</Text><TextInput accessibilityLabel="Player name" placeholder="Choose a name" placeholderTextColor="#fff" maxLength={24} value={displayName} onChangeText={setDisplayName} autoCapitalize="words" autoCorrect={false} returnKeyType="done" style={s.nameInput} /><Text style={s.hint}>Saved automatically. Used when you start your next match.</Text></View>
        <View style={s.sectionBlock}><Text style={s.ruleTitle}>Your match</Text><Text style={s.body}>{game ? `${game.players.length} players • ${game.layout ?? 'Open'} board • ${game.moves} turns played` : 'Your first race is waiting for you.'}</Text>{game && <Text style={s.hint}>{game.winner === null ? 'Your progress is saved and ready to continue.' : `${game.players[game.winner].name} won your last match.`}</Text>}<Button secondary title={game ? 'View your match →' : 'Start playing →'} disabled={!ready} onPress={() => navigateTab('Play')} /></View>
        <View style={s.sectionBlock}><Text style={s.ruleTitle}>Level progress</Text><Text style={s.heading}>{progress.completed.length} / {LEVEL_COUNT} completed</Text><Text style={s.body}>{progress.completed.length === LEVEL_COUNT ? 'Every level conquered. Replay any level.' : `Next challenge: level ${progress.completed.length + 1}. Win to keep progressing.`}</Text><Button secondary title="Choose a level →" onPress={openSetup} /></View>
        <Text style={s.eyebrow}>PREFERENCES</Text>
        <View style={s.sectionBlock}><Text style={s.ruleTitle}>Computer strategy</Text><Text style={s.body}>{tactical ? 'Tactical opponents move and place walls to slow you down.' : 'Relaxed opponents focus on finding their shortest route.'}</Text><Button secondary title={tactical ? 'Difficulty: Tactical' : 'Difficulty: Relaxed'} onPress={() => setTactical(!tactical)} /></View>
        <View style={s.sectionBlock}><Text style={s.ruleTitle}>App updates</Text><Text style={s.body}>Barricade • Version 1.0.2{ '\n' }Your game works offline. Connect only to download an update.</Text><Button secondary disabled={updating} title={updating ? 'Checking…' : 'Check for updates'} onPress={checkUpdates} /></View>
        <Text style={s.footer}>BARRICADE • BUILT TO MAKE YOU THINK</Text>
      </>}
      {!!notice && screen !== 'game' && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text>}
    </ScrollView>
    <FloatingTabs active={selectedTab} onSelect={navigateTab} />
    <Modal transparent visible={paused && screen === 'game'} animationType="fade" onRequestClose={() => setPaused(false)}><View style={s.overlay}><View style={s.modal}><Text style={s.eyebrow}>TAKE A BREATHER</Text><Text style={s.heading}>Your next move can wait.</Text><Text style={s.body}>Your match is saved on this device.</Text><Button title="Resume match" onPress={() => setPaused(false)} /><Button secondary title="How to play" onPress={() => { setPaused(false); setScreen('rules'); }} /><Button secondary title="Set up a new match" onPress={openSetup} /><Button secondary title="Leave to home" onPress={() => navigateTab('Home')} /></View></View></Modal>
    <Modal transparent visible={confirmNew} animationType="fade" onRequestClose={() => setConfirmNew(false)}><View style={s.overlay}><View style={s.modal}><Text style={s.heading}>Start a fresh match?</Text><Text style={s.body}>This replaces your unfinished saved match.</Text><Button title="Start new match" onPress={start} /><Button secondary title="Keep my match" onPress={() => setConfirmNew(false)} /></View></View></Modal>
  </SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><Content /></SafeAreaProvider>; }
const s = StyleSheet.create({
  levelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 16 }, levelChoice: { flexBasis: '30%', flexGrow: 1, borderBottomWidth: 1, borderBottomColor: '#ffffff40', paddingVertical: 14, minHeight: 56, alignItems: 'center', gap: 5 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginVertical: 16 }, avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#ffc92818', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: yellow, fontSize: 25, fontWeight: '800' }, nameInput: { color: '#fff', fontSize: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#ffffff40' },
  safe: { flex: 1, backgroundColor: '#000' }, topbar: { width: '100%', maxWidth: 580, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerLogoFrame: { width: 112, height: 40, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, headerLogo: { width: 112, height: 112 }, pause: { minHeight: 44, paddingLeft: 18, justifyContent: 'center' }, pauseText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  content: { padding: 18, paddingBottom: 40, width: '100%', maxWidth: 560, alignSelf: 'center' }, logoFrame: { height: 70, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 20 }, logo: { width: 150, height: 150 }, eyebrow: { color: yellow, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 12 }, hero: { color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: -1.2, lineHeight: 40, marginBottom: 14 }, subtitle: { color: '#fff', fontSize: 15, lineHeight: 23, marginBottom: 20 }, sectionBlock: { paddingVertical: 16, marginBottom: 12 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, section: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1.3, flexShrink: 1 }, muted: { color: '#fff', fontSize: 9, fontWeight: '700' }, label: { fontSize: 10, color: '#fff', letterSpacing: 1.5, fontWeight: '700', marginTop: 22, marginBottom: 9 }, choice: { flex: 1, borderBottomWidth: 1, borderBottomColor: '#ffffff40', paddingVertical: 14, alignItems: 'center' }, choiceActive: { borderBottomColor: yellow }, choiceText: { color: '#fff', fontSize: 13, fontWeight: '700' }, button: { minHeight: 50, paddingHorizontal: 15, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: yellow, marginTop: 14 }, secondaryButton: { backgroundColor: 'transparent' }, buttonText: { color: '#000', fontSize: 15, fontWeight: '800' }, link: { color: '#fff', fontSize: 13, textAlign: 'center', paddingVertical: 15 }, footer: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 1.2, textAlign: 'center', marginTop: 18 }, heading: { color: '#fff', fontWeight: '800', fontSize: 24, letterSpacing: -0.5, marginBottom: 8 }, roundBadge: { padding: 12, alignItems: 'center', minWidth: 56 }, turnNumber: { color: '#fff', fontSize: 20, fontWeight: '800' }, players: { flexDirection: 'row', gap: 6, marginVertical: 12 }, player: { flex: 1, borderBottomWidth: 2, borderBottomColor: 'transparent', paddingVertical: 10, paddingHorizontal: 4, gap: 5 }, playerName: { color: '#fff', fontSize: 11, fontWeight: '700' }, playerIndex: { fontSize: 20, fontWeight: '900' }, boardCard: { marginBottom: 18 }, goal: { color: yellow, fontSize: 9, fontWeight: '800', letterSpacing: 1, textAlign: 'center', marginBottom: 10 },  hint: { color: '#fff', fontSize: 12, lineHeight: 18, marginTop: 12 }, activity: { color: '#fff', fontSize: 12, textAlign: 'center', marginTop: 5 }, notice: { color: yellow, paddingVertical: 14, lineHeight: 21, marginTop: 12, fontSize: 13 }, rule: { flexDirection: 'row', gap: 16, paddingVertical: 20 }, ruleNumber: { color: yellow, fontSize: 16, fontWeight: '800' }, ruleTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 }, body: { color: '#fff', fontSize: 14, lineHeight: 23 }, overlay: { flex: 1, backgroundColor: '#000c', alignItems: 'center', justifyContent: 'center', padding: 24 }, modal: { width: '100%', maxWidth: 420, backgroundColor: '#000', borderColor: '#ffffff40', borderWidth: 1, borderRadius: 0, padding: 24 }
});


