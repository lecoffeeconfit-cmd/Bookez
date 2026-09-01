export type BookezWritingFrequency = 'everyday' | 'weekdays' | 'weekends' | 'custom';
export type BookezPaceFlexibility = 'gentle' | 'steady' | 'ambitious' | 'custom';
export type BookezReminderKind = 'foundation' | 'steady' | 'catch_up' | 'complete' | 'paused';

export type BookezReminderActivity = {
  words: number;
  minutes: number;
  writingUses: number;
};

export type BookezReminderSession = {
  timestamp: number;
  writingMinutes: number;
  wordsAdded?: number;
};

export type BookezReminderProgressInput = {
  wordCount: number;
  targetWords: number;
  progressPercent: number;
  nextPartTitle?: string;
  manuscriptComplete: boolean;
  firstDraftStarted: boolean;
  outlineReady: boolean;
  writingFrequency?: BookezWritingFrequency;
  customWritingDays?: number[];
  paceFlexibility?: BookezPaceFlexibility;
  customPaceWords?: string;
  plannedCompletionDate?: string;
  writingPlanCreatedAt?: number;
  writingPlanPaused?: boolean;
  activity?: Record<string, BookezReminderActivity>;
  writingSessionHistory?: BookezReminderSession[];
};

export type BookezReminderInsight = {
  kind: BookezReminderKind;
  missedSessions: number;
  recentWritingDays: number;
  recentWordsPerDay: number;
  suggestedWords: number;
  suggestedMinutes: number;
  remainingWords: number;
  finishLabel: string;
  finishDetail: string;
  goalLabel: string;
  summary: string;
};

const DAY_MS = 86_400_000;

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));

const roundToFifty = (value: number) => Math.max(50, Math.round(value / 50) * 50);

const dayKey = (date: Date) => {
  const local = new Date(date);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
};

const dateForKey = (key: string) => new Date(`${key}T12:00:00`);

const isScheduledWritingDay = (frequency: BookezWritingFrequency | undefined, customDays: number[] | undefined, date: Date) => {
  if (!frequency) return false;
  const day = date.getDay();
  if (frequency === 'everyday') return true;
  if (frequency === 'weekdays') return day >= 1 && day <= 5;
  if (frequency === 'weekends') return day === 0 || day === 6;
  return Boolean(customDays?.includes(day));
};

const activityCountsAsWriting = (activity?: BookezReminderActivity) => Boolean(activity && (activity.words > 0 || activity.minutes >= 5 || activity.writingUses > 0));

const sessionMinutesFor = (pace?: BookezPaceFlexibility, frequency?: BookezWritingFrequency) => {
  const paceMinutes = pace === 'gentle' ? 15 : pace === 'ambitious' ? 45 : pace === 'custom' ? 30 : 25;
  return frequency === 'weekends' ? Math.max(paceMinutes, 45) : frequency === 'weekdays' ? Math.max(paceMinutes, 20) : paceMinutes;
};

const formatFinishDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const countScheduledDays = (start: Date, end: Date, frequency: BookezWritingFrequency | undefined, customDays?: number[]) => {
  let count = 0;
  const cursor = new Date(start);
  cursor.setHours(12, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(12, 0, 0, 0);
  while (cursor <= endDate) {
    if (isScheduledWritingDay(frequency, customDays, cursor)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

export function getBookezReminderInsight(input: BookezReminderProgressInput, now = Date.now()): BookezReminderInsight {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const lookbackStart = new Date(today);
  lookbackStart.setDate(lookbackStart.getDate() - 13);
  const planStart = input.writingPlanCreatedAt ? new Date(input.writingPlanCreatedAt) : lookbackStart;
  planStart.setHours(0, 0, 0, 0);
  const windowStart = new Date(Math.max(lookbackStart.getTime(), planStart.getTime()));
  const frequency = input.writingFrequency;
  const formalSchedule = Boolean(frequency && (frequency !== 'custom' || input.customWritingDays?.length));
  const activity = input.activity ?? {};
  const windowEntries = Object.entries(activity).filter(([key]) => {
    const date = dateForKey(key);
    return date >= windowStart && date <= today;
  });
  const recentWritingEntries = windowEntries.filter(([, entry]) => entry.words > 0);
  const recentWritingDays = recentWritingEntries.length;
  const recentWords = recentWritingEntries.reduce((total, [, entry]) => total + entry.words, 0);
  const recentWordsPerDay = recentWritingDays ? Math.round(recentWords / recentWritingDays) : 0;
  const recentSessions = (input.writingSessionHistory ?? []).filter((session) => session.timestamp >= windowStart.getTime() && session.timestamp <= now && session.writingMinutes > 0);
  const recentSessionMinutes = recentSessions.length ? recentSessions.reduce((total, session) => total + session.writingMinutes, 0) / recentSessions.length : 0;
  const customWords = Number.parseInt((input.customPaceWords ?? '').replace(/,/g, ''), 10) || 0;
  const fallbackWords = input.paceFlexibility === 'gentle' ? 300 : input.paceFlexibility === 'ambitious' ? 800 : 500;
  const baseWords = customWords || recentWordsPerDay || fallbackWords;
  const suggestedMinutes = Math.max(10, Math.round(recentSessionMinutes || sessionMinutesFor(input.paceFlexibility, frequency)));
  const remainingWords = Math.max(0, input.targetWords - input.wordCount);

  const scheduledPastDays: string[] = [];
  const scheduleCursor = new Date(windowStart);
  while (scheduleCursor < today) {
    if (isScheduledWritingDay(frequency, input.customWritingDays, scheduleCursor)) scheduledPastDays.push(dayKey(scheduleCursor));
    scheduleCursor.setDate(scheduleCursor.getDate() + 1);
  }
  const completedScheduledDays = scheduledPastDays.filter((key) => activityCountsAsWriting(activity[key])).length;
  // Keep the return invitation emotionally light even if someone has been away
  // for weeks. The plan catches up one small step at a time rather than showing
  // a giant backlog.
  const missedSessions = formalSchedule ? Math.min(3, Math.max(0, scheduledPastDays.length - completedScheduledDays)) : 0;

  const plannedDate = input.plannedCompletionDate ? new Date(`${input.plannedCompletionDate}T12:00:00`) : null;
  const plannedDateValid = plannedDate && !Number.isNaN(plannedDate.getTime());
  const daysToFinish = plannedDateValid ? Math.ceil((plannedDate!.getTime() - today.getTime()) / DAY_MS) : null;
  const scheduledDaysRemaining = plannedDateValid && daysToFinish !== null && daysToFinish >= 0
    ? countScheduledDays(today, plannedDate!, frequency, input.customWritingDays)
    : 0;
  const dueWordsPerDay = scheduledDaysRemaining > 0 ? Math.ceil(remainingWords / scheduledDaysRemaining) : 0;
  const returnWords = roundToFifty(clamp(baseWords * 0.75, 100, Math.max(150, baseWords)));
  const steadyWords = roundToFifty(clamp(Math.max(baseWords, dueWordsPerDay), 100, Math.max(800, baseWords * 1.35)));
  const catchUp = !input.manuscriptComplete && (missedSessions >= 2 || (formalSchedule && recentWritingDays === 0 && scheduledPastDays.length >= 3));

  if (input.writingPlanPaused) {
    return { kind: 'paused', missedSessions, recentWritingDays, recentWordsPerDay, suggestedWords: returnWords, suggestedMinutes, remainingWords, finishLabel: 'Paused', finishDetail: 'Your writing plan is paused.', goalLabel: 'Your pace is yours to choose.', summary: 'Nothing is waiting for you today.' };
  }
  if (input.manuscriptComplete || (input.targetWords > 0 && remainingWords === 0)) {
    return { kind: 'complete', missedSessions, recentWritingDays, recentWordsPerDay, suggestedWords: 0, suggestedMinutes, remainingWords: 0, finishLabel: 'Ready for review', finishDetail: 'Your target words are drafted.', goalLabel: 'Take a calm final read-through.', summary: 'Your manuscript is complete.' };
  }
  if (!input.firstDraftStarted && !input.outlineReady) {
    return { kind: 'foundation', missedSessions, recentWritingDays, recentWordsPerDay, suggestedWords: returnWords, suggestedMinutes, remainingWords, finishLabel: plannedDateValid ? formatFinishDate(plannedDate!) : 'Open-ended', finishDetail: plannedDateValid ? 'Your planned finish line.' : 'Choose a finish line whenever it helps.', goalLabel: 'One small planning step is enough.', summary: 'Your next nudge will help make the book easier to begin.' };
  }
  if (catchUp) {
    const returnMinutes = Math.max(10, Math.round(suggestedMinutes * 0.75));
    const hasFutureFinishLine = plannedDateValid && daysToFinish !== null && daysToFinish >= 0;
    return { kind: 'catch_up', missedSessions, recentWritingDays, recentWordsPerDay, suggestedWords: returnWords, suggestedMinutes: returnMinutes, remainingWords, finishLabel: hasFutureFinishLine ? formatFinishDate(plannedDate!) : 'Reset when ready', finishDetail: hasFutureFinishLine ? 'We’ll keep the return light and keep moving toward your finish line.' : 'Based on your recent writing pace; choose a new finish line when it helps.', goalLabel: `A gentle return: about ${formatCount(returnWords)} words or ${returnMinutes} minutes.`, summary: `${missedSessions ? `${missedSessions} missed writing day${missedSessions === 1 ? '' : 's'} folded into a lighter return.` : 'A lighter return is waiting.'}` };
  }

  const finishLabel = plannedDateValid
    ? daysToFinish !== null && daysToFinish >= 0 ? formatFinishDate(plannedDate!) : 'Finish line needs a reset'
    : `About ${Math.max(1, Math.ceil(remainingWords / Math.max(1, steadyWords * Math.max(1, writingDaysPerWeek(frequency, input.customWritingDays)))))} weeks`;
  const finishDetail = plannedDateValid
    ? daysToFinish !== null && daysToFinish >= 0 ? `At about ${formatCount(steadyWords)} words per writing day.` : 'Choose a new date or let the book stay open-ended.'
    : `Based on ${recentWordsPerDay ? 'your recent writing pace' : 'a steady starting pace'}.`;
  return { kind: 'steady', missedSessions, recentWritingDays, recentWordsPerDay, suggestedWords: steadyWords, suggestedMinutes, remainingWords, finishLabel, finishDetail, goalLabel: `About ${formatCount(steadyWords)} words keeps the book moving.`, summary: plannedDateValid && daysToFinish !== null && daysToFinish < 0 ? 'Your finish line has passed, so the next nudge stays small while you reset it.' : 'Your next nudge follows the rhythm you have been building.' };
}

function writingDaysPerWeek(frequency?: BookezWritingFrequency, customDays?: number[]) {
  if (frequency === 'weekdays') return 5;
  if (frequency === 'weekends') return 2;
  if (frequency === 'custom') return customDays?.length ?? 0;
  return frequency === 'everyday' ? 7 : 1;
}

function formatCount(value: number) {
  return value.toLocaleString('en-US');
}
