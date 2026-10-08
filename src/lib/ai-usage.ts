import type { AIWritingContextMode } from './ai-writing';
import { bookezSecureStorage } from './secure-storage';

export const AI_USAGE_STORAGE_KEY = 'bookez.ai-usage.v1';
export const AI_CONTEXT_MODE_STORAGE_KEY = 'bookez.ai-context-mode.v1';

/**
 * One place for the user-facing weights. These are product credits, not raw
 * token counts. A future plan service can replace the limit without changing
 * the assistant UI or the request contract.
 */
const configuredMonthlyCredits = Number.parseInt(process.env.EXPO_PUBLIC_AI_MONTHLY_CREDITS ?? '', 10);

export const AI_USAGE_POLICY = {
  monthlyCredits: Number.isFinite(configuredMonthlyCredits) && configuredMonthlyCredits > 0 ? configuredMonthlyCredits : 120,
  weights: {
    page: 1,
    nearby: 2,
    'book-aware': 4,
  } satisfies Record<Exclude<AIWritingContextMode, 'auto'>, number>,
  projectWeights: { scanChunk: 2, editChunk: 3, addPart: 8 },
  projectReservePercent: 30,
} as const;

export type AIUsageLedger = {
  month: string;
  usedCredits: number;
};

/** Internal shape for future server-side cost accounting; never shown to users. */
export type AIUsageAccounting = {
  requestId: string;
  model?: string;
  contextMode: Exclude<AIWritingContextMode, 'auto'>;
  weightedCredits: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
};

export const aiUsageMonthKey = (date = new Date()) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

export const aiUsageWeight = (mode: Exclude<AIWritingContextMode, 'auto'>) => AI_USAGE_POLICY.weights[mode];

export const aiProjectCreditCeiling = () => Math.floor(AI_USAGE_POLICY.monthlyCredits * (1 - AI_USAGE_POLICY.projectReservePercent / 100));

export const readAIUsage = async (): Promise<number> => {
  try {
    const raw = await bookezSecureStorage.getItem(AI_USAGE_STORAGE_KEY);
    const ledger = raw ? JSON.parse(raw) as Partial<AIUsageLedger> : null;
    return ledger?.month === aiUsageMonthKey() && Number.isFinite(ledger.usedCredits)
      ? Math.max(0, ledger.usedCredits as number)
      : 0;
  } catch { return 0; }
};

let usageWriteQueue: Promise<unknown> = Promise.resolve();

/** Local, user-facing credit estimate. The cloud function does not enforce this ledger. */
export const recordAIUsage = (credits: number, protectReserve = false): Promise<number> => {
  const operation = usageWriteQueue.then(async () => {
    const used = await readAIUsage();
    const ceiling = protectReserve ? aiProjectCreditCeiling() : AI_USAGE_POLICY.monthlyCredits;
    if (used + credits > ceiling) throw new Error(protectReserve
      ? `This request needs ${credits} credits, but Bookez is protecting the final 30% of monthly credits.`
      : `This request needs ${credits} AI credits, but only ${Math.max(0, ceiling - used)} remain.`);
    const nextUsed = used + credits;
    await bookezSecureStorage.setItem(AI_USAGE_STORAGE_KEY, JSON.stringify({ month: aiUsageMonthKey(), usedCredits: nextUsed } satisfies AIUsageLedger));
    return nextUsed;
  });
  usageWriteQueue = operation.catch(() => undefined);
  return operation;
};

export const aiUsageNextResetDate = (date = new Date()) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

export const aiUsageRefillLabel = (date = new Date()) => `Refills ${aiUsageNextResetDate(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

export const aiUsageCooldownLabel = (date = new Date()) => {
  const nextReset = aiUsageNextResetDate(date);
  return `${nextReset.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${nextReset.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
};

export const aiUsageCooldownRemaining = (date = new Date()) => {
  const minutesRemaining = Math.max(0, Math.ceil((aiUsageNextResetDate(date).getTime() - date.getTime()) / 60000));
  const days = Math.floor(minutesRemaining / (24 * 60));
  const hours = Math.floor((minutesRemaining % (24 * 60)) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutesRemaining % 60}m`;
  return `${minutesRemaining}m`;
};
