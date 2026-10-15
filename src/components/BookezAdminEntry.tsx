import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { BookezAdminService } from '../lib/bookez-admin';
import { bookezColors as c } from '../theme/bookez';
import BookezAdminCenter, { AdminShield } from './BookezAdminCenter';

/** Private Profile entry. No build flag, email shortcut, or tap bypass. */
export default function BookezAdminEntry() {
  const [userId, setUserId] = useState<string | null>(null);
  const [approvedUserId, setApprovedUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [check, setCheck] = useState(0);
  const identity = useRef<string | null>(null);
  const request = useRef(0);
  useEffect(() => {
    let live = true;
    let authEvent = false;
    const apply = (id: string | null) => {
      if (!live) return;
      if (id !== identity.current) { request.current += 1; identity.current = id; setApprovedUserId(null); setOpen(false); }
      setUserId(id); setCheck((value) => value + 1);
    };
    void supabase.auth.getSession().then(({ data: { session } }) => { if (!authEvent) apply(session?.user.id ?? null); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { authEvent = true; apply(session?.user.id ?? null); });
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') setCheck((value) => value + 1); else setOpen(false); });
    return () => { live = false; request.current += 1; subscription.unsubscribe(); app.remove(); };
  }, []);
  useEffect(() => {
    const id = ++request.current;
    if (!userId) { setApprovedUserId(null); setOpen(false); return; }
    void BookezAdminService.access().then((allowed) => {
      if (id !== request.current || identity.current !== userId) return;
      setApprovedUserId(allowed ? userId : null);
      if (!allowed) setOpen(false);
    });
    return () => { request.current += 1; };
  }, [userId, check]);
  if (!userId || approvedUserId !== userId) return null;
  return <>
    <Pressable onPress={() => { setCheck((value) => value + 1); setOpen(true); }} style={s.entry} accessibilityRole="button" accessibilityLabel="Open Bookez admin center">
      <View style={s.icon}><AdminShield /></View><View style={s.copy}><Text style={s.kicker}>PRIVATE OPERATIONS</Text><Text style={s.title}>Open admin center</Text><Text style={s.hint}>Writer controls, product signals, and support.</Text></View><Text style={s.arrow}>›</Text>
    </Pressable>
    <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setOpen(false)}>{open && <BookezAdminCenter onClose={() => setOpen(false)} onAccessLost={() => { setApprovedUserId(null); setOpen(false); }} />}</Modal>
  </>;
}
const s = StyleSheet.create({
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 17, marginTop: 22, marginBottom: 5, borderRadius: 19, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised }, icon: { width: 43, height: 48, borderRadius: 14, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 }, kicker: { color: c.secondaryAccent, fontSize: 8, fontWeight: '800', letterSpacing: 0.9 }, title: { color: c.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 5 }, hint: { color: c.textSecondary, fontSize: 10, lineHeight: 15, marginTop: 4 }, arrow: { color: c.secondaryAccent, fontSize: 24 },
});
