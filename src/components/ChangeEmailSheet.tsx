import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { bookezColors, bookezRadii, bookezShadows, bookezSpacing, bookezType, bookezWithAlpha } from '../theme/bookez';
import { isBookezEmailValid, normalizeBookezEmail, requestBookezEmailChange } from '../lib/bookez-auth';

type ChangeEmailSheetProps = {
  visible: boolean;
  currentEmail: string | null;
  onClose: () => void;
  onEmailConfirmed?: (email: string) => void;
};

type ChangeEmailError = { code?: string; message?: string };

function emailChangeErrorMessage(caught: unknown) {
  const error = caught as ChangeEmailError;
  const code = error?.code?.toLowerCase() ?? '';
  const message = error?.message?.toLowerCase() ?? '';

  if (code.includes('rate') || message.includes('rate limit') || message.includes('too many')) {
    return 'Too many requests were made. Please wait a little while, then try again.';
  }
  if (message.includes('already') || message.includes('registered') || message.includes('exists')) {
    return 'That email address is already connected to another account.';
  }
  if (code.includes('session') || message.includes('not authenticated') || message.includes('sign in')) {
    return 'Your Bookez session has expired. Sign in again before changing your email.';
  }
  return 'We could not send the confirmation email. Check your connection and try again.';
}

export default function ChangeEmailSheet({ visible, currentEmail, onClose, onEmailConfirmed }: ChangeEmailSheetProps) {
  const [newEmail, setNewEmail] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [status, setStatus] = useState<'form' | 'success'>('form');
  const entrance = useRef(new Animated.Value(0)).current;

  const normalizedCurrentEmail = normalizeBookezEmail(currentEmail ?? '');
  const normalizedNewEmail = normalizeBookezEmail(newEmail);
  const normalizedConfirmation = normalizeBookezEmail(confirmation);
  const formReady = useMemo(() => Boolean(
    normalizedCurrentEmail
      && isBookezEmailValid(normalizedNewEmail)
      && normalizedNewEmail !== normalizedCurrentEmail
      && normalizedConfirmation === normalizedNewEmail,
  ), [normalizedConfirmation, normalizedCurrentEmail, normalizedNewEmail]);

  useEffect(() => {
    if (!visible) return;
    setNewEmail('');
    setConfirmation('');
    setBusy(false);
    setError('');
    setSubmittedEmail('');
    setStatus('form');
    entrance.setValue(0);
    const animation = Animated.spring(entrance, { toValue: 1, tension: 58, friction: 9, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [entrance, visible]);

  const submit = async () => {
    if (busy) return;
    const nextEmail = normalizeBookezEmail(newEmail);
    const nextConfirmation = normalizeBookezEmail(confirmation);
    setError('');

    if (!isBookezEmailValid(nextEmail)) {
      setError('Enter a valid email address, like you@example.com.');
      return;
    }
    if (nextEmail === normalizedCurrentEmail) {
      setError('Enter an email address different from your current one.');
      return;
    }
    if (nextConfirmation !== nextEmail) {
      setError('The email addresses do not match yet.');
      return;
    }

    setBusy(true);
    try {
      const confirmedUser = await requestBookezEmailChange(nextEmail);
      setSubmittedEmail(nextEmail);
      setStatus('success');
      // Supabase normally returns the existing address while the new address
      // is pending. Only let the parent update its display when the response
      // itself confirms that the address is already active.
      if (confirmedUser?.email && normalizeBookezEmail(confirmedUser.email) === nextEmail) onEmailConfirmed?.(confirmedUser.email);
    } catch (caught) {
      setError(emailChangeErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal animationType="slide" visible={visible} transparent onRequestClose={busy ? undefined : onClose}>
      <View style={emailS.shade}>
        <Pressable style={emailS.dismiss} onPress={busy ? undefined : onClose} accessibilityLabel="Close change email" />
        <KeyboardAvoidingView style={emailS.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View style={[emailS.sheet, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [34, 0] }) }] }]}>
            <LinearGradient colors={[bookezColors.surface, bookezColors.background, bookezColors.surfaceRaised]} style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" style={emailS.orbOne} />
            <View pointerEvents="none" style={emailS.orbTwo} />
            <ScrollView contentContainerStyle={emailS.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={emailS.topBar}>
                <View style={emailS.headingRow}>
                  <View style={emailS.seal}><Text style={emailS.sealText}>✦</Text></View>
                  <View style={emailS.headingCopy}><Text style={emailS.eyebrow}>BOOKEZ / ACCOUNT</Text><Text style={emailS.title}>{status === 'success' ? 'A new address awaits.' : 'Change your email.'}</Text></View>
                </View>
                <Pressable onPress={onClose} disabled={busy} style={emailS.closeButton} accessibilityRole="button" accessibilityLabel="Close change email"><Text style={emailS.closeText}>×</Text></Pressable>
              </View>

              {status === 'success' ? <View style={emailS.successState}>
                <View style={emailS.successSeal}><Text style={emailS.successSealText}>✓</Text></View>
                <Text style={emailS.successTitle}>Confirmation sent</Text>
                <Text style={emailS.successCopy}>We sent a confirmation link to your new email address. Open that message to complete the change.</Text>
                <View style={emailS.pendingCard}><Text style={emailS.pendingLabel}>WAITING FOR CONFIRMATION</Text><Text style={emailS.pendingEmail}>{submittedEmail}</Text><Text style={emailS.pendingHint}>Your current email stays active until the link is opened.</Text></View>
                <Pressable onPress={onClose} style={emailS.primaryButton} accessibilityRole="button" accessibilityLabel="Done changing email"><Text style={emailS.primaryButtonText}>Done</Text><Text style={emailS.primaryButtonArrow}>→</Text></Pressable>
              </View> : <>
                <Text style={emailS.copy}>Your email is used to sign in and receive account confirmations. We’ll keep your current address active until the new one is verified.</Text>
                <View style={emailS.currentCard}><View style={emailS.currentIcon}><Text style={emailS.currentIconText}>◎</Text></View><View style={emailS.currentCopy}><Text style={emailS.fieldLabel}>CURRENT EMAIL</Text><Text numberOfLines={2} style={emailS.currentEmail}>{currentEmail ?? 'Not available'}</Text></View></View>
                <Text style={emailS.fieldLabel}>NEW EMAIL ADDRESS</Text>
                <TextInput value={newEmail} onChangeText={(value) => { setNewEmail(value); setError(''); }} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" placeholder="you@example.com" placeholderTextColor={bookezColors.textMuted} style={emailS.input} accessibilityLabel="New email address" returnKeyType="next" />
                <Text style={[emailS.fieldLabel, emailS.confirmLabel]}>CONFIRM NEW EMAIL</Text>
                <TextInput value={confirmation} onChangeText={(value) => { setConfirmation(value); setError(''); }} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" placeholder="Enter it again" placeholderTextColor={bookezColors.textMuted} style={emailS.input} accessibilityLabel="Confirm new email address" onSubmitEditing={() => void submit()} returnKeyType="done" />
                <View style={emailS.note}><Text style={emailS.noteMark}>i</Text><Text style={emailS.noteText}>For your protection, Supabase may ask you to confirm the change from your current and new inboxes.</Text></View>
                {error ? <View style={emailS.errorBox}><Text style={emailS.errorMark}>!</Text><Text style={emailS.errorText}>{error}</Text></View> : null}
                <Pressable onPress={() => void submit()} disabled={!formReady || busy} style={[emailS.primaryButton, (!formReady || busy) && emailS.primaryButtonDisabled]} accessibilityRole="button" accessibilityState={{ disabled: !formReady || busy }} accessibilityLabel="Send email change confirmation">
                  {busy ? <ActivityIndicator size="small" color={bookezColors.textOnAccent} /> : null}<Text style={emailS.primaryButtonText}>{busy ? 'Sending confirmation…' : 'Send confirmation link'}</Text>{!busy ? <Text style={emailS.primaryButtonArrow}>→</Text> : null}
                </Pressable>
                <Pressable onPress={onClose} disabled={busy} style={emailS.cancelButton} accessibilityRole="button"><Text style={emailS.cancelText}>Cancel</Text></Pressable>
              </>}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const emailS = StyleSheet.create({
  shade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(4,10,9,0.78)' },
  dismiss: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  keyboard: { maxHeight: '93%' },
  sheet: { overflow: 'hidden', borderTopLeftRadius: bookezRadii.sheet, borderTopRightRadius: bookezRadii.sheet, borderWidth: 1, borderBottomWidth: 0, borderColor: bookezColors.border, backgroundColor: bookezColors.surface, ...bookezShadows.lifted },
  content: { padding: bookezSpacing.xl, paddingBottom: bookezSpacing.xxl },
  orbOne: { position: 'absolute', top: -90, right: -70, width: 230, height: 230, borderRadius: 115, backgroundColor: bookezColors.accent, opacity: 0.14 },
  orbTwo: { position: 'absolute', bottom: -120, left: -90, width: 250, height: 250, borderRadius: 125, backgroundColor: bookezColors.secondaryAccent, opacity: 0.07 },
  topBar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headingRow: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingRight: bookezSpacing.sm },
  seal: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: bookezColors.secondaryAccentSoft, borderWidth: 1, borderColor: bookezColors.secondaryAccent },
  sealText: { color: bookezColors.textPrimary, fontSize: 20 },
  headingCopy: { flex: 1, marginLeft: bookezSpacing.sm },
  eyebrow: { ...bookezType.label, color: bookezColors.secondaryAccent },
  title: { ...bookezType.pageTitle, color: bookezColors.textPrimary, marginTop: 4 },
  closeButton: { width: 36, height: 36, borderRadius: bookezRadii.control, alignItems: 'center', justifyContent: 'center', backgroundColor: bookezWithAlpha(bookezColors.surfaceRaised, 0.9), borderWidth: 1, borderColor: bookezColors.divider },
  closeText: { color: bookezColors.textSecondary, fontSize: 23, lineHeight: 25 },
  copy: { ...bookezType.bodySecondary, marginTop: bookezSpacing.lg, lineHeight: 20 },
  currentCard: { marginTop: bookezSpacing.lg, padding: bookezSpacing.sm, flexDirection: 'row', alignItems: 'center', borderRadius: bookezRadii.card, backgroundColor: bookezWithAlpha(bookezColors.surfaceRaised, 0.86), borderWidth: 1, borderColor: bookezColors.divider },
  currentIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: bookezColors.accentSoft, borderWidth: 1, borderColor: bookezColors.manuscriptEdge },
  currentIconText: { color: bookezColors.secondaryAccent, fontSize: 18 },
  currentCopy: { flex: 1, minWidth: 0, marginLeft: bookezSpacing.sm },
  fieldLabel: { ...bookezType.label, color: bookezColors.secondaryAccent, marginTop: bookezSpacing.lg },
  currentEmail: { ...bookezType.body, color: bookezColors.textPrimary, marginTop: 3 },
  confirmLabel: { marginTop: bookezSpacing.md },
  input: { minHeight: 50, marginTop: bookezSpacing.xs, paddingHorizontal: bookezSpacing.sm, borderRadius: bookezRadii.control, borderWidth: 1, borderColor: bookezColors.divider, backgroundColor: bookezColors.surfaceRaised, color: bookezColors.textPrimary, fontSize: 14 },
  note: { marginTop: bookezSpacing.md, padding: bookezSpacing.sm, flexDirection: 'row', alignItems: 'flex-start', borderRadius: bookezRadii.control, backgroundColor: bookezWithAlpha(bookezColors.secondaryAccentSoft, 0.7), borderWidth: 1, borderColor: bookezWithAlpha(bookezColors.secondaryAccent, 0.35) },
  noteMark: { width: 20, height: 20, borderRadius: 10, textAlign: 'center', lineHeight: 20, color: bookezColors.textOnAccent, backgroundColor: bookezColors.secondaryAccent, fontSize: 12, fontWeight: '800' },
  noteText: { flex: 1, marginLeft: bookezSpacing.xs, color: bookezColors.textSecondary, fontSize: 11, lineHeight: 16 },
  errorBox: { marginTop: bookezSpacing.sm, padding: bookezSpacing.sm, flexDirection: 'row', alignItems: 'flex-start', borderRadius: bookezRadii.control, backgroundColor: bookezColors.destructiveSoft, borderWidth: 1, borderColor: bookezWithAlpha(bookezColors.destructive, 0.45) },
  errorMark: { width: 20, height: 20, borderRadius: 10, textAlign: 'center', lineHeight: 20, color: bookezColors.textOnAccent, backgroundColor: bookezColors.destructive, fontSize: 12, fontWeight: '800' },
  errorText: { flex: 1, marginLeft: bookezSpacing.xs, color: bookezColors.textPrimary, fontSize: 11, lineHeight: 16 },
  primaryButton: { minHeight: 50, marginTop: bookezSpacing.lg, paddingHorizontal: bookezSpacing.md, borderRadius: bookezRadii.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: bookezColors.accent, borderWidth: 1, borderColor: bookezColors.accentStrong },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: { ...bookezType.button, color: bookezColors.textOnAccent },
  primaryButtonArrow: { marginLeft: bookezSpacing.sm, color: bookezColors.textOnAccent, fontSize: 18 },
  cancelButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  cancelText: { ...bookezType.button, color: bookezColors.textMuted },
  successState: { alignItems: 'center', paddingTop: bookezSpacing.xl },
  successSeal: { width: 72, height: 72, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: bookezColors.successSoft, borderWidth: 1, borderColor: bookezColors.success },
  successSealText: { color: bookezColors.textPrimary, fontSize: 30, fontWeight: '700' },
  successTitle: { ...bookezType.sectionTitle, color: bookezColors.textPrimary, marginTop: bookezSpacing.md, fontSize: 22 },
  successCopy: { ...bookezType.bodySecondary, marginTop: bookezSpacing.xs, textAlign: 'center', lineHeight: 20 },
  pendingCard: { alignSelf: 'stretch', marginTop: bookezSpacing.lg, padding: bookezSpacing.md, borderRadius: bookezRadii.card, backgroundColor: bookezWithAlpha(bookezColors.surfaceRaised, 0.9), borderWidth: 1, borderColor: bookezColors.divider },
  pendingLabel: { ...bookezType.label, color: bookezColors.secondaryAccent },
  pendingEmail: { ...bookezType.body, color: bookezColors.textPrimary, marginTop: bookezSpacing.xs },
  pendingHint: { ...bookezType.caption, color: bookezColors.textMuted, marginTop: bookezSpacing.xs, lineHeight: 17 },
});
