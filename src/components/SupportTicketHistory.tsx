import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { readMyBookezSupport } from '../lib/bookez-admin';
import { adminLabel, type SupportTicket } from '../lib/admin-model';
import { supabase } from '../lib/supabase';
import { bookezColors as c } from '../theme/bookez';

export default function SupportTicketHistory({ refreshToken = 0 }: { refreshToken?: number }) {
  const [open, setOpen] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { generation.current += 1; setOpen(false); setTickets([]); });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const id = ++generation.current;
    if (!open) return;
    setBusy(true); setError('');
    void readMyBookezSupport().then((result) => { if (generation.current === id) setTickets(result); })
      .catch((caught) => { if (generation.current === id) setError(caught instanceof Error ? caught.message : 'Messages unavailable.'); })
      .finally(() => { if (generation.current === id) setBusy(false); });
    return () => { generation.current += 1; };
  }, [open, refreshToken, retry]);
  return <View style={s.wrap}><Pressable onPress={() => setOpen(!open)} style={s.toggle} accessibilityRole="button" accessibilityState={{ expanded: open }}><Text style={s.title}>Your recent feedback & replies</Text><Text style={s.title}>{open ? '−' : '+'}</Text></Pressable>{open && <>
    {busy ? <ActivityIndicator color={c.accent} /> : error ? <Pressable onPress={() => setRetry((value) => value + 1)} accessibilityRole="button"><Text style={s.body}>{error} Tap to retry.</Text></Pressable> : tickets.length ? tickets.map((ticket) => <View key={ticket.id} style={s.ticket}><Text style={s.label}>{adminLabel(ticket.status).toUpperCase()} · {new Date(ticket.created_at).toLocaleDateString()}</Text><Text style={s.title}>{ticket.subject}</Text><Text style={s.body}>{ticket.message}</Text>{ticket.messages.map((message) => <View key={message.id} style={s.reply}><Text style={s.label}>REPLY FROM BOOKEZ</Text><Text style={s.body}>{message.body}</Text></View>)}</View>) : <Text style={s.body}>Messages you send to Bookez will appear here.</Text>}
  </>}</View>;
}
const s = StyleSheet.create({
  wrap: { marginTop: 17, borderTopWidth: 1, borderTopColor: c.divider, paddingTop: 8 }, toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, gap: 10 }, title: { color: c.textPrimary, fontSize: 12, fontWeight: '700' }, ticket: { borderRadius: 12, backgroundColor: c.surfaceRaised, padding: 12, marginTop: 9, gap: 7 }, label: { color: c.secondaryAccent, fontSize: 8, letterSpacing: 0.5, fontWeight: '800' }, body: { color: c.textSecondary, fontSize: 11, lineHeight: 17 }, reply: { padding: 11, backgroundColor: c.accentSoft, borderRadius: 10, gap: 7, marginTop: 5 },
});
