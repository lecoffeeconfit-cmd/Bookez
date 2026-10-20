export type JourneyTimeEstimate = { minMinutes: number; maxMinutes: number; label: string; detail: string };

export function journeyTimeRange(minMinutes: number, maxMinutes: number, detail: string): JourneyTimeEstimate {
  const min = Math.max(1, Math.round(minMinutes));
  const max = Math.max(min, Math.round(maxMinutes));
  const label = max < 120
    ? `${min === max ? min : `${min}–${max}`} min`
    : (() => {
      const low = Math.max(0.5, Math.round(min / 30) / 2);
      const high = Math.max(low, Math.ceil(max / 30) / 2);
      return `${low === high ? low : `${low}–${high}`} hr`;
    })();
  return { minMinutes: min, maxMinutes: max, label, detail };
}

export function estimateJourneyDraft({ remainingWords, activity, sessionMinutes, sessionWords }: {
  remainingWords: number;
  activity: { words: number; minutes: number }[];
  sessionMinutes: number;
  sessionWords: number;
}): JourneyTimeEstimate {
  if (remainingWords <= 0) return { minMinutes: 0, maxMinutes: 0, label: 'Complete', detail: 'This part has reached its draft target.' };
  const recent = activity.filter((day) => day.words > 0 && day.minutes > 0).slice(-14);
  const minutes = recent.reduce((total, day) => total + day.minutes, 0);
  const words = recent.reduce((total, day) => total + day.words, 0);
  const hasMeasuredPace = minutes >= 15 && words > 0;
  const plannedPace = sessionWords > 0 && sessionMinutes > 0 ? sessionWords / sessionMinutes : 20;
  const wordsPerMinute = Math.max(5, Math.min(100, hasMeasuredPace ? words / minutes : plannedPace));
  const expected = Math.max(0, remainingWords) / wordsPerMinute;
  const min = Math.max(5, Math.floor(expected * 0.8 / 5) * 5);
  const max = Math.max(min + 5, Math.ceil(expected * 1.25 / 5) * 5);
  return journeyTimeRange(min, max, `Active writing time, based on ${hasMeasuredPace ? 'your recent writing pace' : sessionWords > 0 ? 'your planned session pace' : 'a starting pace of 20 words per minute'}. Spread it across as many sessions as you like.`);
}

export function combineJourneyEstimates(estimates: JourneyTimeEstimate[]): JourneyTimeEstimate {
  if (!estimates.length) return { minMinutes: 0, maxMinutes: 0, label: 'No steps left', detail: 'This checkpoint has no remaining steps.' };
  return journeyTimeRange(
    estimates.reduce((total, estimate) => total + estimate.minMinutes, 0),
    estimates.reduce((total, estimate) => total + estimate.maxMinutes, 0),
    'Approximate active time for the remaining steps in this checkpoint. Take it at your own pace.',
  );
}
