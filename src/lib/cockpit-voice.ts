import { requireOptionalNativeModule } from 'expo';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { loadBookezSpeechVoice } from './speech-preferences';
import { ownsSpeechSession, releaseSpeechSession, requestSpeechSession, waitForSpeechRecognitionIdle } from './speech-session';

type SpeechRecognitionPackage = typeof import('expo-speech-recognition');
const recognition = requireOptionalNativeModule('ExpoSpeechRecognition')
  ? require('expo-speech-recognition') as SpeechRecognitionPackage
  : null;
const native = recognition?.ExpoSpeechRecognitionModule;
const MAX_UTTERANCE_LENGTH = 8_000;
let nextVoiceId = 0;

export type CockpitVoiceMode = 'command' | 'dictation';
export type CockpitVoiceStatus = 'idle' | 'starting' | 'listening' | 'stopping' | 'speaking' | 'error';
export type CockpitVoiceFinal = { id: string; mode: CockpitVoiceMode; recoveredPartial?: boolean };
export type CockpitVoiceOptions = {
  enabled: boolean;
  mode: CockpitVoiceMode;
  handsFree?: boolean;
  language?: string;
  preferOnDevice?: boolean;
  onFinal: (text: string, metadata: CockpitVoiceFinal) => void | Promise<void>;
};

/**
 * Explicit-start foreground voice session. Put this hook INSIDE the cockpit so
 * interim transcripts never rerender Write. Capture can use mode="dictation";
 * its caller persists each callback into the same capture note. stop() flushes
 * partial dictation synchronously; partial commands are never executed.
 * Neither opening the panel nor changing modes starts the microphone.
 */
export function useCockpitVoice(options: CockpitVoiceOptions) {
  const [status, setStatus] = useState<CockpitVoiceStatus>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [onDevice, setOnDevice] = useState<boolean | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const ownerRef = useRef('');
  if (!ownerRef.current) ownerRef.current = `cockpit-voice-${++nextVoiceId}`;
  const ownerId = ownerRef.current;
  const mounted = useRef(true);
  const foreground = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const version = useRef(0);
  const desired = useRef(false);
  const starting = useRef(false);
  const listening = useRef(false);
  const speaking = useRef(false);
  const partial = useRef('');
  const sessionMode = useRef<CockpitVoiceMode>(options.mode);
  const run = useRef(0);
  const utterance = useRef(0);
  const speechEpoch = useRef(0);
  const seenFinals = useRef(new Set<string>());
  const pendingFinals = useRef(0);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakDone = useRef<(() => void) | null>(null);
  const startRef = useRef<() => Promise<void>>(async () => {});
  const stopRef = useRef<() => void>(() => {});
  const failRef = useRef<(message: string) => void>(() => {});
  const queueRestartRef = useRef<() => void>(() => {});

  const updateStatus = useCallback((next: CockpitVoiceStatus) => { if (mounted.current) setStatus(next); }, []);
  const clearTimers = useCallback(() => {
    if (restartTimer.current) clearTimeout(restartTimer.current);
    if (startWatchdog.current) clearTimeout(startWatchdog.current);
    if (speechWatchdog.current) clearTimeout(speechWatchdog.current);
    restartTimer.current = null;
    startWatchdog.current = null;
    speechWatchdog.current = null;
  }, []);

  const deliver = useCallback((text: string, recoveredPartial = false) => {
    const content = text.trim();
    if (!content) return;
    if (content.length > MAX_UTTERANCE_LENGTH) {
      if (sessionMode.current === 'command') { failRef.current('That command was too long and was not executed. Use a shorter command or Capture mode.'); return; }
      // Preserve long captures in bounded callbacks instead of silently clipping speech.
      let offset = 0;
      while (offset < content.length) {
        let end = Math.min(content.length, offset + MAX_UTTERANCE_LENGTH);
        if (end < content.length) {
          const boundary = content.lastIndexOf(' ', end);
          if (boundary > offset + MAX_UTTERANCE_LENGTH / 2) end = boundary;
        }
        deliver(content.slice(offset, end), recoveredPartial);
        offset = end;
      }
      return;
    }
    const metadata: CockpitVoiceFinal = {
      id: `${ownerId}:${run.current}:${++utterance.current}`,
      mode: sessionMode.current,
      ...(recoveredPartial ? { recoveredPartial: true } : {}),
    };
    pendingFinals.current += 1;
    try {
      void Promise.resolve(optionsRef.current.onFinal(content, metadata)).then(() => {
        pendingFinals.current -= 1;
        if (mounted.current) queueRestartRef.current();
      }, () => {
        pendingFinals.current -= 1;
        if (mounted.current) failRef.current('Your captured words could not be saved. Listening paused; please check the saved note before continuing.');
      });
    } catch {
      pendingFinals.current -= 1;
      failRef.current('Your captured words could not be saved. Listening paused; please check the saved note before continuing.');
    }
  }, [ownerId]);

  const flushPartial = useCallback(() => {
    const text = partial.current;
    partial.current = '';
    if (mounted.current) setInterim('');
    if (sessionMode.current === 'dictation' && text.trim()) deliver(text, true);
  }, [deliver]);

  const stop = useCallback(() => {
    version.current += 1;
    desired.current = false;
    starting.current = false;
    clearTimers();
    flushPartial();
    const owned = ownsSpeechSession(ownerId);
    releaseSpeechSession(ownerId);
    listening.current = false;
    if (owned) { try { native?.abort(); } catch { /* Already interrupted by the OS. */ } }
    if (speaking.current) {
      speaking.current = false;
      void Speech.stop().catch(() => {});
    }
    speakDone.current?.();
    speakDone.current = null;
    updateStatus('idle');
  }, [clearTimers, flushPartial, ownerId, updateStatus]);
  stopRef.current = stop;

  const fail = useCallback((message: string) => {
    stop();
    if (mounted.current) setError(message);
    updateStatus('error');
  }, [stop, updateStatus]);
  failRef.current = fail;

  const queueRestart = useCallback(() => {
    if (!desired.current || pendingFinals.current > 0 || !optionsRef.current.handsFree || !optionsRef.current.enabled || !foreground.current || speaking.current) return;
    if (restartTimer.current) clearTimeout(restartTimer.current);
    restartTimer.current = setTimeout(() => { restartTimer.current = null; void startRef.current(); }, 250);
  }, []);
  queueRestartRef.current = queueRestart;

  const start = useCallback(async () => {
    if (!optionsRef.current.enabled || !foreground.current || starting.current || listening.current || speaking.current) return;
    if (!native) { fail('Direct voice recognition needs a Bookez development or installed build. You can still type, or use your keyboard microphone.'); return; }
    const attempt = ++version.current;
    const valid = () => mounted.current && optionsRef.current.enabled && foreground.current && version.current === attempt;
    desired.current = true;
    starting.current = true;
    if (mounted.current) setError(null);
    updateStatus('starting');
    try {
      if (!native.isRecognitionAvailable()) throw new Error('Speech recognition is unavailable on this device. You can still type or use your keyboard microphone.');
      // Awaiting stop prevents Bookez read-aloud from being transcribed as a command.
      await Speech.stop();
      if (!valid()) return;
      const permission = await native.requestPermissionsAsync();
      if (!valid()) return;
      if (!permission.granted) throw new Error('Allow microphone and speech recognition in Settings to use voice. Typing is still available.');
      let offline = optionsRef.current.preferOnDevice !== false && native.supportsOnDeviceRecognition();
      const language = optionsRef.current.language ?? 'en-US';
      if (offline && Platform.OS === 'android') {
        try {
          const locales = await native.getSupportedLocales({});
          offline = locales.installedLocales.some((locale) => locale.replace('_', '-').toLowerCase() === language.toLowerCase());
        } catch { offline = false; }
      }
      if (!valid()) return;
      const claimed = await requestSpeechSession(ownerId, () => stopRef.current(), () => waitForSpeechRecognitionIdle(native));
      if (!claimed) return;
      if (!valid()) { if (version.current === attempt) releaseSpeechSession(ownerId); return; }
      run.current += 1;
      utterance.current = 0;
      speechEpoch.current = 0;
      seenFinals.current.clear();
      partial.current = '';
      sessionMode.current = optionsRef.current.mode;
      listening.current = true;
      if (mounted.current) { setInterim(''); setOnDevice(offline); }
      startWatchdog.current = setTimeout(() => {
        startWatchdog.current = null;
        if (valid() && listening.current) failRef.current('The microphone did not start. Listening has stopped; try again.');
      }, 10_000);
      native.start({
        lang: language,
        interimResults: true,
        continuous: sessionMode.current === 'dictation',
        maxAlternatives: 1,
        addsPunctuation: true,
        requiresOnDeviceRecognition: offline,
        iosTaskHint: sessionMode.current === 'command' ? 'confirmation' : 'dictation',
        contextualStrings: sessionMode.current === 'command' ? ['Add note', 'Continue writing', 'Create character', 'Outline next chapter', 'Stop listening'] : undefined,
      });
    } catch (reason) {
      if (valid()) fail(reason instanceof Error ? reason.message : 'Voice could not start. Please try again.');
    } finally {
      if (version.current === attempt) starting.current = false;
    }
  }, [fail, ownerId, updateStatus]);
  startRef.current = start;

  const speak = useCallback(async (text: string): Promise<void> => {
    if (!optionsRef.current.enabled || !foreground.current || !text.trim()) return;
    const resume = desired.current && Boolean(optionsRef.current.handsFree);
    stop();
    const attempt = version.current;
    const valid = () => mounted.current && optionsRef.current.enabled && foreground.current && version.current === attempt;
    try {
      const claimed = await requestSpeechSession(ownerId, () => stopRef.current(), async () => {
        if (native) await waitForSpeechRecognitionIdle(native);
      });
      if (!claimed) return;
      if (!valid()) { if (version.current === attempt) releaseSpeechSession(ownerId); return; }
      await Speech.stop();
      const voice = await loadBookezSpeechVoice().catch(() => null);
      if (!valid()) { if (version.current === attempt) releaseSpeechSession(ownerId); return; }
      speaking.current = true;
      updateStatus('speaking');
      const content = text.trim().slice(0, Math.min(1_800, Speech.maxSpeechInputLength));
      await new Promise<void>((resolve) => {
        let finished = false;
        const finish = (failed = false) => {
          if (finished) return;
          finished = true;
          if (speechWatchdog.current) clearTimeout(speechWatchdog.current);
          speechWatchdog.current = null;
          speakDone.current = null;
          speaking.current = false;
          releaseSpeechSession(ownerId);
          if (valid()) {
            updateStatus(failed ? 'error' : 'idle');
            if (failed) { desired.current = false; setError('Spoken playback was interrupted. Tap Listen when you are ready.'); }
            else if (resume) { desired.current = true; queueRestart(); }
          }
          resolve();
        };
        speakDone.current = () => finish();
        speechWatchdog.current = setTimeout(() => { void Speech.stop().catch(() => {}); finish(true); }, Math.min(120_000, 10_000 + content.length * 90));
        Speech.speak(content, { language: optionsRef.current.language ?? 'en-US', voice: voice?.identifier, rate: 0.95, useApplicationAudioSession: false, onDone: () => finish(), onStopped: () => finish(true), onError: () => finish(true) });
      });
    } catch (reason) {
      if (valid()) fail(reason instanceof Error ? reason.message : 'Spoken playback could not start.');
    }
  }, [ownerId, queueRestart, stop, updateStatus, fail]);

  useEffect(() => {
    mounted.current = true;
    const stateSubscription = AppState.addEventListener('change', (state) => {
      foreground.current = state === 'active';
      if (!foreground.current) stopRef.current();
    });
    const subscriptions = native ? [
      native.addListener('start', () => {
        if (!ownsSpeechSession(ownerId) || !listening.current || !optionsRef.current.enabled) return;
        if (startWatchdog.current) clearTimeout(startWatchdog.current);
        startWatchdog.current = null;
        updateStatus('listening');
      }),
      native.addListener('speechstart', () => {
        if (ownsSpeechSession(ownerId) && listening.current) speechEpoch.current += 1;
      }),
      native.addListener('result', (event) => {
        if (!ownsSpeechSession(ownerId) || !listening.current || !optionsRef.current.enabled || !foreground.current) return;
        const transcript = event.results[0]?.transcript?.trim() ?? '';
        if (!transcript) return;
        const segments = event.results[0]?.segments ?? [];
        const position = segments.length ? `${segments[0].startTimeMillis}:${segments[segments.length - 1].endTimeMillis}` : String(speechEpoch.current);
        const key = `${position}:${transcript.length}:${transcript.slice(0, 64)}:${transcript.slice(-64)}`;
        if (seenFinals.current.has(key)) return;
        if (!event.isFinal) {
          partial.current = transcript; setInterim(transcript.slice(-MAX_UTTERANCE_LENGTH));
          if (transcript.length > MAX_UTTERANCE_LENGTH) failRef.current(sessionMode.current === 'dictation' ? 'A long capture was saved in sections. Listening paused; tap Listen to continue.' : 'That command was too long and was not executed. Use a shorter command or Capture mode.');
          return;
        }
        if (seenFinals.current.size >= 32) seenFinals.current.delete(seenFinals.current.values().next().value!);
        seenFinals.current.add(key);
        partial.current = '';
        setInterim('');
        deliver(transcript);
      }),
      native.addListener('end', () => {
        if (!ownsSpeechSession(ownerId) || !listening.current) return;
        flushPartial();
        releaseSpeechSession(ownerId);
        listening.current = false;
        if (startWatchdog.current) clearTimeout(startWatchdog.current);
        startWatchdog.current = null;
        updateStatus('idle');
        queueRestart();
      }),
      native.addListener('error', (event) => {
        if (!ownsSpeechSession(ownerId) || !listening.current) return;
        const description = event.error === 'network'
          ? 'The recognition service lost its connection. Captured words were kept; listening has stopped.'
          : event.error === 'interrupted'
            ? 'A call or audio interruption paused listening. Captured words were kept.'
            : event.error === 'no-speech' || event.error === 'speech-timeout'
              ? 'No speech was detected. Tap Listen to try again.'
              : event.message || 'Speech recognition was interrupted. Tap Listen to try again.';
        failRef.current(description);
      }),
    ] : [];
    return () => {
      stopRef.current();
      mounted.current = false;
      stateSubscription.remove();
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [deliver, flushPartial, ownerId, queueRestart, updateStatus]);

  useEffect(() => { stop(); }, [options.enabled, options.mode, stop]);

  return {
    available: Boolean(native),
    unavailableReason: native ? null : 'Direct voice needs an installed Bookez build. Type here or use the keyboard microphone.',
    status,
    interim,
    error,
    onDevice,
    start,
    stop,
    speak,
    clearError: useCallback(() => { setError(null); updateStatus('idle'); }, [updateStatus]),
  };
}
