import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const MAIN_TABS = ['Home', 'Play', 'Profile'] as const;
export type MainTab = typeof MAIN_TABS[number];
const ACCENT = '#ffc928';

function TabIcon({ tab, color }: { tab: MainTab; color: string }) {
  if (tab === 'Play') return <View style={s.icon}><View style={[s.play, { borderLeftColor: color }]} /></View>;
  if (tab === 'Profile') return <View style={s.icon}><View style={[s.head, { borderColor: color }]} /><View style={[s.shoulders, { borderColor: color }]} /></View>;
  return <View style={s.icon}><View style={[s.roof, { borderColor: color }]} /><View style={[s.house, { borderColor: color }]} /></View>;
}

export function FloatingTabs({ active, onSelect }: { active: MainTab; onSelect: (tab: MainTab) => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // The app has three destinations; keep future additions within five tabs.
  const tabs: readonly MainTab[] = MAIN_TABS;
  if (tabs.length > 5) throw new Error('Use at most five bottom navigation tabs.');
  const pillWidth = Math.min(280, width - 36);
  return <View accessibilityRole="tablist" style={[s.pill, { width: pillWidth, left: (width - pillWidth) / 2, bottom: Math.max(insets.bottom, 12) + 8 }]}>
    {tabs.map(tab => {
      const selected = tab === active;
      const color = selected ? ACCENT : '#fff';
      return <Pressable key={tab} accessibilityRole="tab" accessibilityLabel={tab} accessibilityState={{ selected }} onPress={() => onSelect(tab)} hitSlop={2} style={({ pressed }) => [s.tab, pressed && { opacity: 0.55 }]}>
        <TabIcon tab={tab} color={color} />
        <Text maxFontSizeMultiplier={1.5} style={[s.label, { color, fontWeight: selected ? '800' : '500' }]}>{tab}</Text>
        <View style={[s.indicator, { backgroundColor: selected ? ACCENT : 'transparent' }]} />
      </Pressable>;
    })}
  </View>;
}
const s = StyleSheet.create({
  pill: { position: 'absolute', height: 60, borderRadius: 21, backgroundColor: '#000', borderWidth: 1, borderColor: '#ffffff50', flexDirection: 'row', alignItems: 'center', paddingVertical: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 10 }, indicator: { width: 4, height: 4, borderRadius: 2 },
  icon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  play: { width: 0, height: 0, borderTopWidth: 7, borderBottomWidth: 7, borderLeftWidth: 11, borderTopColor: 'transparent', borderBottomColor: 'transparent', marginLeft: 3 },
  head: { width: 7, height: 7, borderWidth: 1.7, borderRadius: 5, position: 'absolute', top: 1 },
  shoulders: { width: 15, height: 8, borderWidth: 1.7, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, position: 'absolute', bottom: 1 },
  roof: { width: 11, height: 11, borderLeftWidth: 1.7, borderTopWidth: 1.7, transform: [{ rotate: '45deg' }], position: 'absolute', top: 2 },
  house: { width: 12, height: 10, borderLeftWidth: 1.7, borderRightWidth: 1.7, borderBottomWidth: 1.7, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, position: 'absolute', bottom: 1 }
});
