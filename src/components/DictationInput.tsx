import { requireOptionalNativeModule } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Animated, Easing, Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { bookezColors } from '../theme/bookez';
import { useBookezReduceMotion } from './BookezUI';
import { BookezBookmark, BookezManuscript } from './bookez-art';

type SpeechRecognitionPackage = typeof import('expo-speech-recognition');

const speechRecognition = requireOptionalNativeModule('ExpoSpeechRecognition')
  ? require('expo-speech-recognition') as SpeechRecognitionPackage
  : null;

type InputMode = 'dictation' | 'writing';

type DictationInputProps = TextInputProps & {
  grow?: boolean;
  editorial?: boolean;
  trailingAccessory?: ReactNode;
  trailingAccessoryWidth?: number;
  onInputMode?: (mode: InputMode) => void;
  onDictationState?: (active: boolean) => void;
};

let nextDictationInputId = 0;
let activeDictationInputId: string | null = null;

function ManuscriptSurface({ pulseKey, sceneKey }: { pulseKey: string; sceneKey: string }) {
  const reduceMotion = useBookezReduceMotion();
  const pull = useRef(new Animated.Value(0)).current;
  const gleam = useRef(new Animated.Value(0)).current;
  const settle = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const previousPulseKey = useRef(pulseKey);

  useEffect(() => {
    settle.stopAnimation();
    if (reduceMotion) {
      settle.setValue(1);
      return;
    }
    settle.setValue(0);
    Animated.timing(settle, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    }).start();
  }, [reduceMotion, sceneKey, settle]);

  useEffect(() => {
    if (previousPulseKey.current === pulseKey) return;
    previousPulseKey.current = pulseKey;
    pull.stopAnimation();
    gleam.stopAnimation();
    pull.setValue(0);
    gleam.setValue(0);
    if (reduceMotion) return;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pull, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true, isInteraction: false }),
          Animated.timing(pull, { toValue: 0, duration: 310, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false }),
        ]),
        Animated.timing(gleam, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true, isInteraction: false }),
      ]).start();
    }, 850);
    return () => clearTimeout(timer);
  }, [gleam, pull, pulseKey, reduceMotion]);

  return <Animated.View pointerEvents="none" style={[s.manuscriptSurface, {
    opacity: settle,
    transform: [
      { perspective: 900 },
      { translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) },
      { rotateX: settle.interpolate({ inputRange: [0, 1], outputRange: ['1.8deg', '0deg'] }) },
      { scale: settle.interpolate({ inputRange: [0, 1], outputRange: [0.992, 1] }) },
    ],
  }]}>
    <View pointerEvents="none" style={s.manuscriptPageStack} />
    <LinearGradient pointerEvents="none" colors={['#FBF6EC', '#F5EBDD', '#FAF3E7']} start={{ x: 0.05, y: 0 }} end={{ x: 0.92, y: 1 }} style={s.manuscriptPaper} />
    <LinearGradient pointerEvents="none" colors={['rgba(133,96,55,0.16)', 'rgba(133,96,55,0.035)', 'rgba(133,96,55,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.manuscriptEdgeLeft} />
    <LinearGradient pointerEvents="none" colors={['rgba(133,96,55,0)', 'rgba(133,96,55,0.03)', 'rgba(133,96,55,0.14)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.manuscriptEdgeRight} />
    <LinearGradient pointerEvents="none" colors={['rgba(133,96,55,0)', 'rgba(133,96,55,0.11)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.manuscriptEdgeBottom} />
    <View pointerEvents="none" style={s.manuscriptPatinaOne} />
    <View pointerEvents="none" style={s.manuscriptPatinaTwo} />
    <View pointerEvents="none" style={s.manuscriptPatinaThree} />
    <Animated.View pointerEvents="none" style={[s.manuscriptBookmark, { transform: [{ translateY: pull.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) }, { rotate: pull.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '1.5deg'] }) }, { scale: pull.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }] }]}><BookezBookmark width={22} height={35} color={bookezColors.secondaryAccent} /></Animated.View>
    <Animated.View style={[s.manuscriptSaveGleam, { opacity: gleam.interpolate({ inputRange: [0, 0.18, 0.72, 1], outputRange: [0, 0.72, 0.34, 0] }), transform: [{ translateX: gleam.interpolate({ inputRange: [0, 1], outputRange: [-18, 82] }) }] }]}><LinearGradient colors={['rgba(177,133,67,0)', 'rgba(177,133,67,0.8)', 'rgba(255,245,204,0.9)', 'rgba(177,133,67,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /></Animated.View>
    <View pointerEvents="none" style={s.manuscriptRule}><BookezManuscript width={155} height={18} color={bookezColors.textPrimary} accent={bookezColors.manuscriptEdge} /></View>
  </Animated.View>;
}

const KeyboardDictationInput = forwardRef<TextInput, DictationInputProps>(function KeyboardDictationInput({ style, accessibilityLabel, grow = false, editorial = false, trailingAccessory, trailingAccessoryWidth = 76, onInputMode, onDictationState, onKeyPress, ...props }, ref) {
  const inputRef = useRef<TextInput>(null);
  const keyboardDictationRef = useRef(false);
  const fieldName = accessibilityLabel ? ` for ${accessibilityLabel}` : '';
  const manuscript = editorial && accessibilityLabel?.toLowerCase().endsWith('manuscript');
  const endKeyboardDictation = () => {
    if (!keyboardDictationRef.current) return;
    keyboardDictationRef.current = false;
    onDictationState?.(false);
  };
  useEffect(() => () => endKeyboardDictation(), []);
  const openKeyboardForDictation = () => {
    keyboardDictationRef.current = true;
    onInputMode?.('dictation');
    onDictationState?.(true);
    inputRef.current?.focus();
  };

  return <View style={[s.field, manuscript && s.manuscriptField, grow && s.fieldGrow]}>{manuscript && <ManuscriptSurface sceneKey={accessibilityLabel ?? ''} pulseKey={`${accessibilityLabel ?? ''}:${typeof props.value === 'string' ? props.value : ''}`} />}
    <TextInput ref={(instance) => { inputRef.current = instance; if (typeof ref === 'function') ref(instance); else if (ref) ref.current = instance; }} {...props} showSoftInputOnFocus onKeyPress={(event) => { onKeyPress?.(event); onInputMode?.('writing'); endKeyboardDictation(); }} accessibilityLabel={accessibilityLabel} style={[style, s.input, manuscript && s.manuscriptInput, trailingAccessory ? { paddingRight: trailingAccessoryWidth } : null]} />
    <View style={[s.actionRail, manuscript && s.manuscriptActionRail]}>
      {trailingAccessory}
      <Pressable onPress={openKeyboardForDictation} hitSlop={8} style={[s.button, editorial && s.buttonEditorial]} accessibilityRole="button" accessibilityLabel={`Open keyboard dictation${fieldName}`} accessibilityHint="Opens the keyboard. Tap the keyboard microphone to dictate.">
        <Text style={[s.icon, editorial && s.iconEditorial]}>◉</Text>
      </Pressable>
    </View>
  </View>;
});

const NativeDictationInput = forwardRef<TextInput, DictationInputProps>(function NativeDictationInput({ style, accessibilityLabel, grow = false, editorial = false, trailingAccessory, trailingAccessoryWidth = 76, onInputMode, onDictationState, onChangeText, onKeyPress, value, ...props }, ref) {
  const { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } = speechRecognition!;
  const [isDictating, setIsDictating] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const inputIdRef = useRef<string | null>(null);
  const isDictatingRef = useRef(false);
  const valueRef = useRef(typeof value === 'string' ? value : '');
  const sessionBaseRef = useRef('');
  const onDictationStateRef = useRef(onDictationState);
  if (!inputIdRef.current) inputIdRef.current = `dictation-input-${++nextDictationInputId}`;
  const inputId = inputIdRef.current;

  useEffect(() => {
    onDictationStateRef.current = onDictationState;
  }, [onDictationState]);

  useEffect(() => {
    valueRef.current = typeof value === 'string' ? value : '';
  }, [value]);

  useEffect(() => {
    isDictatingRef.current = isDictating;
  }, [isDictating]);

  useEffect(() => () => {
    if (activeDictationInputId === inputId) {
      activeDictationInputId = null;
      isDictatingRef.current = false;
      onDictationStateRef.current?.(false);
      ExpoSpeechRecognitionModule.abort();
    }
  }, []);

  useSpeechRecognitionEvent('result', (event) => {
    if (!isDictatingRef.current || activeDictationInputId !== inputId) return;
    const transcript = event.results[0]?.transcript?.trim();
    if (!transcript) return;
    const prefix = sessionBaseRef.current;
    onChangeText?.(`${prefix}${prefix.trim() ? ' ' : ''}${transcript}`);
  });

  useSpeechRecognitionEvent('end', () => {
    if (!isDictatingRef.current || activeDictationInputId !== inputId) return;
    activeDictationInputId = null;
    isDictatingRef.current = false;
    setIsDictating(false);
    onDictationStateRef.current?.(false);
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (!isDictatingRef.current || activeDictationInputId !== inputId) return;
    activeDictationInputId = null;
    isDictatingRef.current = false;
    setIsDictating(false);
    onDictationStateRef.current?.(false);
    if (!['aborted', 'no-speech', 'speech-timeout'].includes(event.error)) {
      Alert.alert('Dictation unavailable', event.message || 'Speech recognition could not start on this device.');
    }
  });

  const startDictation = async () => {
    if (isDictating || isStarting) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      Alert.alert('Dictation unavailable', 'Speech recognition is not available on this device.');
      return;
    }

    setIsStarting(true);
    try {
      const permissions = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permissions.granted) {
        Alert.alert('Microphone permission needed', 'Allow microphone and speech recognition access in Settings to dictate directly in Bookez.');
        return;
      }

      if (activeDictationInputId && activeDictationInputId !== inputId) ExpoSpeechRecognitionModule.abort();
      sessionBaseRef.current = valueRef.current;
      activeDictationInputId = inputId;
      isDictatingRef.current = true;
      setIsDictating(true);
      onInputMode?.('dictation');
      onDictationStateRef.current?.(true);
      ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: true, addsPunctuation: true });
    } catch {
      isDictatingRef.current = false;
      setIsDictating(false);
      onDictationStateRef.current?.(false);
      Alert.alert('Dictation unavailable', 'Speech recognition could not start on this device.');
    } finally {
      setIsStarting(false);
    }
  };

  const dictating = isDictating || isStarting;
  const fieldName = accessibilityLabel ? ` for ${accessibilityLabel}` : '';
  const manuscript = editorial && accessibilityLabel?.toLowerCase().endsWith('manuscript');
  return <View style={[s.field, manuscript && s.manuscriptField, grow && s.fieldGrow]}>{manuscript && <ManuscriptSurface sceneKey={accessibilityLabel ?? ''} pulseKey={`${accessibilityLabel ?? ''}:${typeof value === 'string' ? value : ''}`} />}
    <TextInput ref={ref} {...props} value={value} onChangeText={onChangeText} onKeyPress={(event) => { onKeyPress?.(event); onInputMode?.('writing'); onDictationStateRef.current?.(false); }} accessibilityLabel={accessibilityLabel} style={[style, s.input, manuscript && s.manuscriptInput, trailingAccessory ? { paddingRight: trailingAccessoryWidth } : null]} />
    <View style={[s.actionRail, manuscript && s.manuscriptActionRail]}>
      {trailingAccessory}
      <Pressable onPress={() => void startDictation()} disabled={isStarting} hitSlop={8} style={[s.button, editorial && s.buttonEditorial, dictating && (editorial ? s.buttonListeningEditorial : s.buttonListening)]} accessibilityRole="button" accessibilityState={{ busy: isStarting, selected: isDictating }} accessibilityLabel={`${dictating ? 'Stop' : 'Start'} dictation${fieldName}`} accessibilityHint={dictating ? 'Stops dictation and keeps the transcribed text.' : 'Starts dictation directly. The keyboard stays closed.'}>
        <Text style={[s.icon, editorial && s.iconEditorial, dictating && editorial && s.iconListeningEditorial]}>{dictating ? '■' : '◉'}</Text>
      </Pressable>
    </View>
  </View>;
});

const DictationInput = forwardRef<TextInput, DictationInputProps>(function DictationInput(props, ref) {
  return speechRecognition ? <NativeDictationInput {...props} ref={ref} /> : <KeyboardDictationInput {...props} ref={ref} />;
});

export default DictationInput;

const s = StyleSheet.create({
  field: { position: 'relative' },
  fieldGrow: { flex: 1, minWidth: 0 },
  manuscriptField: { paddingRight: 5, paddingBottom: 6, shadowColor: '#493F35', shadowOpacity: 0.16, shadowRadius: 13, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  manuscriptSurface: { ...StyleSheet.absoluteFill, zIndex: 0 },
  manuscriptPageStack: { position: 'absolute', top: 5, right: 0, bottom: 0, left: 8, borderRadius: 5, backgroundColor: bookezColors.parchmentDark, borderWidth: 1, borderColor: bookezColors.manuscriptEdge, transform: [{ rotate: '0.25deg' }] },
  manuscriptPaper: { position: 'absolute', top: 0, right: 5, bottom: 6, left: 0, borderRadius: 5, borderWidth: 1, borderColor: bookezColors.manuscriptEdge, overflow: 'hidden' },
  manuscriptEdgeLeft: { position: 'absolute', top: 4, bottom: 10, left: 1, width: 11, zIndex: 3, opacity: 0.7 },
  manuscriptEdgeRight: { position: 'absolute', top: 4, right: 6, bottom: 10, width: 10, zIndex: 3, opacity: 0.68 },
  manuscriptEdgeBottom: { position: 'absolute', right: 9, bottom: 7, left: 4, height: 11, zIndex: 3, opacity: 0.72 },
  manuscriptPatinaOne: { position: 'absolute', top: 34, left: 15, width: 92, height: 46, borderRadius: 46, backgroundColor: 'rgba(166,126,75,0.026)', zIndex: 3, transform: [{ rotate: '-8deg' }] },
  manuscriptPatinaTwo: { position: 'absolute', top: 124, right: 25, width: 76, height: 110, borderRadius: 48, backgroundColor: 'rgba(120,92,62,0.018)', zIndex: 3, transform: [{ rotate: '12deg' }] },
  manuscriptPatinaThree: { position: 'absolute', bottom: 34, left: 42, width: 142, height: 35, borderRadius: 50, backgroundColor: 'rgba(177,138,82,0.022)', zIndex: 3, transform: [{ rotate: '3deg' }] },
  manuscriptBookmark: { position: 'absolute', top: 7, right: 24, zIndex: 5, opacity: 0.75 },
  manuscriptSaveGleam: { position: 'absolute', top: 1, left: 22, width: 52, height: 2, zIndex: 6 },
  manuscriptRule: { position: 'absolute', top: -2, left: 18, zIndex: 3, opacity: 0.13 },
  input: { paddingRight: 38 },
  manuscriptInput: { marginRight: 5, marginBottom: 6, zIndex: 4, backgroundColor: 'transparent', borderWidth: 0, borderColor: 'transparent', borderRadius: 5, shadowOpacity: 0, elevation: 0 },
  inputWithAccessory: { paddingRight: 76 },
  actionRail: { position: 'absolute', right: 5, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  manuscriptActionRail: { right: 11, bottom: 14, zIndex: 6 },
  button: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: bookezColors.surfaceMuted, borderWidth: 1, borderColor: bookezColors.border },
  buttonListening: { backgroundColor: bookezColors.destructiveSoft, borderColor: bookezColors.destructive },
  buttonEditorial: { backgroundColor: bookezColors.accentSoft, borderColor: '#D7AEB9' },
  buttonListeningEditorial: { backgroundColor: bookezColors.accentStrong, borderColor: bookezColors.accentStrong },
  icon: { color: bookezColors.secondaryAccent, fontSize: 13, lineHeight: 16 },
  iconEditorial: { color: bookezColors.accent },
  iconListeningEditorial: { color: bookezColors.textOnAccent },
});
