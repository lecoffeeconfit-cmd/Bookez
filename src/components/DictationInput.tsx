import { requireOptionalNativeModule } from 'expo';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

type SpeechRecognitionPackage = typeof import('expo-speech-recognition');

const speechRecognition = requireOptionalNativeModule('ExpoSpeechRecognition')
  ? require('expo-speech-recognition') as SpeechRecognitionPackage
  : null;

type InputMode = 'dictation' | 'writing';

type DictationInputProps = TextInputProps & {
  grow?: boolean;
  onInputMode?: (mode: InputMode) => void;
  onDictationState?: (active: boolean) => void;
};

let nextDictationInputId = 0;
let activeDictationInputId: string | null = null;

const KeyboardDictationInput = forwardRef<TextInput, DictationInputProps>(function KeyboardDictationInput({ style, accessibilityLabel, grow = false, onInputMode, onDictationState, onKeyPress, ...props }, ref) {
  const inputRef = useRef<TextInput>(null);
  const keyboardDictationRef = useRef(false);
  const fieldName = accessibilityLabel ? ` for ${accessibilityLabel}` : '';
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

  return <View style={[s.field, grow && s.fieldGrow]}>
    <TextInput ref={(instance) => { inputRef.current = instance; if (typeof ref === 'function') ref(instance); else if (ref) ref.current = instance; }} {...props} showSoftInputOnFocus onKeyPress={(event) => { onKeyPress?.(event); onInputMode?.('writing'); endKeyboardDictation(); }} accessibilityLabel={accessibilityLabel} style={[style, s.input]} />
    <Pressable onPress={openKeyboardForDictation} hitSlop={8} style={s.button} accessibilityRole="button" accessibilityLabel={`Open keyboard dictation${fieldName}`} accessibilityHint="Opens the keyboard. Tap the keyboard microphone to dictate.">
      <Text style={s.icon}>🎙</Text>
    </Pressable>
  </View>;
});

const NativeDictationInput = forwardRef<TextInput, DictationInputProps>(function NativeDictationInput({ style, accessibilityLabel, grow = false, onInputMode, onDictationState, onChangeText, onKeyPress, value, ...props }, ref) {
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
  return <View style={[s.field, grow && s.fieldGrow]}>
    <TextInput ref={ref} {...props} value={value} onChangeText={onChangeText} onKeyPress={(event) => { onKeyPress?.(event); onInputMode?.('writing'); onDictationStateRef.current?.(false); }} accessibilityLabel={accessibilityLabel} style={[style, s.input]} />
    <Pressable onPress={() => void startDictation()} disabled={isStarting} hitSlop={8} style={[s.button, dictating && s.buttonListening]} accessibilityRole="button" accessibilityState={{ busy: isStarting, selected: isDictating }} accessibilityLabel={`${dictating ? 'Stop' : 'Start'} dictation${fieldName}`} accessibilityHint={dictating ? 'Stops dictation and keeps the transcribed text.' : 'Starts dictation directly. The keyboard stays closed.'}>
      <Text style={s.icon}>{dictating ? '■' : '🎙'}</Text>
    </Pressable>
  </View>;
});

const DictationInput = forwardRef<TextInput, DictationInputProps>(function DictationInput(props, ref) {
  return speechRecognition ? <NativeDictationInput {...props} ref={ref} /> : <KeyboardDictationInput {...props} ref={ref} />;
});

export default DictationInput;

const s = StyleSheet.create({
  field: { position: 'relative' },
  fieldGrow: { flex: 1, minWidth: 0 },
  input: { paddingRight: 38 },
  button: { position: 'absolute', right: 5, bottom: 8, width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F1FC', borderWidth: 1, borderColor: '#DED9EF' },
  buttonListening: { backgroundColor: '#FEE8E8', borderColor: '#F3B5B5' },
  icon: { color: '#7068C9', fontSize: 13, lineHeight: 16 },
});
