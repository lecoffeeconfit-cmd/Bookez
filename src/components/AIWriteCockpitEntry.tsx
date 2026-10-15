import { memo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AIWritingContext } from '../lib/ai-writing';
import type { CockpitPreview } from '../lib/ai-cockpit-model';
import { bookezColors as c } from '../theme/bookez';

export type CockpitSnapshot = {
  ownerId: string | null;
  projectId: string;
  projectTitle: string;
  partKey: string;
  partTitle: string;
  text: string;
  revision?: number;
  people: string;
  unitIdeas: string[];
  nextUnit?: { key: string; title: string; index: number };
  parts: Array<{ key: string; title: string }>;
  context: AIWritingContext;
};
export type CockpitBridge = {
  getSnapshot: (partKey?: string) => CockpitSnapshot | null;
  apply: (preview: CockpitPreview, undo?: boolean) => { ok: boolean; reason?: string };
};

/** Only this tiny launcher mounts with Write. Transcript/AI state stays below it. */
function AIWriteCockpitEntry({ bridge }: { bridge: CockpitBridge }) {
  const [opened, setOpened] = useState(false);
  const [visible, setVisible] = useState(false);
  const moduleRef = useRef<typeof import('./AIWriteCockpit') | null>(null);
  if (process.env.EXPO_PUBLIC_AI_COCKPIT_ENABLED === 'false') return null;
  const open = () => {
    if (!moduleRef.current) moduleRef.current = require('./AIWriteCockpit');
    setOpened(true);
    setVisible(true);
  };
  const Cockpit = moduleRef.current?.default;
  return <View style={s.host}>
    <Pressable onPress={open} style={s.button} accessibilityRole="button" accessibilityLabel={opened ? 'Resume Luna cockpit' : 'Open Luna cockpit'} accessibilityHint="Opens voice capture and reviewed AI writing tools without leaving Write.">
      <Text style={s.star}>✧</Text><Text style={s.label}>{opened ? 'Resume Luna' : 'Luna cockpit'}</Text><Text style={s.arrow}>↗</Text>
    </Pressable>
    {opened && Cockpit && <Cockpit bridge={bridge} visible={visible} onMinimize={() => setVisible(false)} onExit={() => { setVisible(false); setOpened(false); }} />}
  </View>;
}
export default memo(AIWriteCockpitEntry);

const s = StyleSheet.create({
  host: { alignSelf: 'flex-start', marginTop: 10 },
  button: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, borderRadius: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c.cardBorder },
  star: { color: c.accent, fontSize: 22 },
  label: { color: c.accent, fontSize: 12, fontWeight: '700' },
  arrow: { color: c.secondaryAccent, fontSize: 16 },
});
