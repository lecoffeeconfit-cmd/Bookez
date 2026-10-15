export type AdminRange = 'today' | '7d' | '30d' | 'all';
export type SupportStatus = 'new' | 'reviewing' | 'in_progress' | 'resolved' | 'closed';
export type SupportPriority = 'low' | 'normal' | 'high' | 'critical';
export type SupportCategory = 'bug' | 'feature_request' | 'account' | 'general' | 'other';
export type AdminAction = 'refill_ai' | 'hide_sharing' | 'restore_sharing' | 'remove_avatar' | 'resolve_report' | 'update_feedback';
export type AdminWriter = {
  id: string; name: string | null; email: string | null; createdAt: string; lastActiveAt: string;
  projects: number; words: number; sessions: number; aiUsed: number; aiMonthly: number; sharingHeld: boolean;
};
export type AdminReport = { id: string; kind: 'community' | 'feedback'; userId: string | null; name: string | null; reason: string; createdAt: string };
export type SupportMessage = { id: string; body: string; created_at: string };
export type SupportTicket = {
  id: string; user_id: string; category: SupportCategory; subject: string; message: string;
  status: SupportStatus; priority: SupportPriority; created_at: string; updated_at: string;
  name?: string | null; email?: string | null; messages: SupportMessage[];
};
export type AdminDashboard = {
  generatedAt: string;
  metrics: { totalUsers: number; newUsers: number; activeWriters: number; projects: number; words: number; sessions: number; writingSeconds: number; wordsWritten: number; aiCredits: number; aiRequests: number; sharedBooks: number; openReports: number; openFeedback: number; reminders: number; reactions: number; follows: number; feedbackResponses: number };
  signals: { noProject: number; noDraft: number; lowAI: number };
  projectTypes: Array<{ label: string; count: number }>;
  topWriters: Array<{ id: string; name: string | null; words: number; sessions: number; seconds: number }>;
  users: AdminWriter[];
  directory: { page: number; totalPages: number; totalUsers: number; pageSize: number };
  reports: AdminReport[];
  audit: Array<{ id: string; action: string; createdAt: string }>;
};
export type AdminInbox = { tickets: SupportTicket[]; unresolved: number; page: number; totalPages: number; total: number };

export const adminRangeOptions: Array<{ id: AdminRange; label: string }> = [
  { id: 'today', label: 'Today' }, { id: '7d', label: '7 days' }, { id: '30d', label: '30 days' }, { id: 'all', label: 'All time' },
];
export const supportStatuses: SupportStatus[] = ['new', 'reviewing', 'in_progress', 'resolved', 'closed'];
export const supportPriorities: SupportPriority[] = ['low', 'normal', 'high', 'critical'];
export const supportCategories: SupportCategory[] = ['bug', 'feature_request', 'account', 'general', 'other'];
export const adminLabel = (value: string) => value.replaceAll('_', ' ');
export const adminDuration = (seconds: number) => seconds < 3600 ? `${Math.round(seconds / 60)} min` : `${(seconds / 3600).toFixed(1)} hr`;
export const adminCreditPercent = (used: number, monthly: number) => monthly > 0 ? Math.max(0, Math.min(100, Math.round(used / monthly * 100))) : 0;

export const writerActionCopy = (writer: AdminWriter, action: AdminAction) => {
  const name = writer.name || writer.email || 'this writer';
  switch (action) {
    case 'refill_ai': return { title: 'Refill AI allowance?', detail: `Restore ${name}’s completed AI usage allowance for this UTC month. In-flight requests still count. This is audited.`, confirm: 'Refill allowance' };
    case 'hide_sharing': return { title: 'Pause Community sharing?', detail: `Unpublish ${name}’s shared books and close their feedback requests. New sharing stays paused until an admin restores it. Their private writing stays intact.`, confirm: 'Pause sharing' };
    case 'restore_sharing': return { title: 'Restore sharing permission?', detail: `Allow ${name} to share again. Nothing is automatically republished; the writer chooses what to share.`, confirm: 'Restore permission' };
    case 'remove_avatar': return { title: 'Remove public picture?', detail: `Remove ${name}’s Community picture. Their account and private writing remain unchanged. Cached pictures may take time to expire.`, confirm: 'Remove picture' };
    default: throw new Error('Unsupported writer action.');
  }
};
