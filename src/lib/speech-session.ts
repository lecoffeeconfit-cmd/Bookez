/** One microphone owner across editor dictation and the optional cockpit. */
type SpeechSession = { ownerId: string; interrupt: () => void | Promise<void> };

let activeSession: SpeechSession | null = null;
let pendingOwnerId: string | null = null;
let requestVersion = 0;

export function ownsSpeechSession(ownerId: string): boolean {
  return activeSession?.ownerId === ownerId;
}

/** Invalidates a pending permission/start as well as an active lease. */
export function releaseSpeechSession(ownerId: string): boolean {
  const owned = activeSession?.ownerId === ownerId;
  const pending = pendingOwnerId === ownerId;
  if (owned) activeSession = null;
  if (pending) pendingOwnerId = null;
  if (pending || (owned && !pendingOwnerId)) requestVersion += 1;
  return owned || pending;
}

/** Last explicit request wins; old native end events drain before handoff. */
export async function requestSpeechSession(
  ownerId: string,
  interrupt: SpeechSession['interrupt'],
  waitUntilIdle: () => Promise<void>,
): Promise<boolean> {
  const version = ++requestVersion;
  pendingOwnerId = ownerId;
  const previous = activeSession;
  try {
    await previous?.interrupt();
    if (activeSession === previous) activeSession = null;
    if (version !== requestVersion) return false;
    await waitUntilIdle();
    if (version !== requestVersion || pendingOwnerId !== ownerId) return false;
    pendingOwnerId = null;
    activeSession = { ownerId, interrupt };
    return true;
  } catch (error) {
    if (version === requestVersion) pendingOwnerId = null;
    throw error;
  }
}

const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/** Bounded native shutdown barrier. Never starts a second recognizer over the first. */
export async function waitForSpeechRecognitionIdle(native: { getStateAsync: () => Promise<string>; abort: () => void }): Promise<void> {
  const deadline = Date.now() + 1_200;
  const busyMessage = 'The microphone is still finishing its previous session. Try again in a moment.';
  const readState = async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        native.getStateAsync(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(busyMessage)), Math.max(1, deadline - Date.now())); }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
  };
  if (await readState() !== 'inactive') native.abort();
  while (Date.now() < deadline) {
    if (await readState() === 'inactive') {
      // Recognition events have no session ID. Give queued end/error events a turn to drain.
      await delay(60);
      if (await readState() === 'inactive') return;
    }
    await delay(80);
  }
  throw new Error(busyMessage);
}
