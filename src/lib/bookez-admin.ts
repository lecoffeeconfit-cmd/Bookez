import { supabase } from './supabase';
import type { AdminAction, AdminDashboard, AdminInbox, AdminRange, SupportCategory, SupportMessage, SupportPriority, SupportStatus, SupportTicket } from './admin-model';

export class BookezAdminAccessError extends Error {}

async function invokeAdmin<T>(method: 'GET' | 'POST', query: Record<string, string | number> = {}, body?: Record<string, unknown>): Promise<T> {
  const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
  const queryString = params.toString();
  const { data, error } = await supabase.functions.invoke<T>(`bookez-admin${queryString ? `?${queryString}` : ''}`, { method, timeout: 30_000, ...(body ? { body } : {}) });
  if (error) {
    const response = (error as { context?: Response }).context;
    let message = 'Bookez admin service is unavailable. Check your connection and deployment.';
    try { const payload = await response?.json(); if (typeof payload?.error === 'string') message = payload.error; } catch { /* Gateway responses may not be JSON. */ }
    if (response?.status === 401 || response?.status === 403) throw new BookezAdminAccessError(message);
    throw new Error(message);
  }
  if (!data) throw new Error('Bookez admin service returned no data.');
  return data;
}

export const BookezAdminService = {
  async access() {
    try { const { data, error } = await supabase.rpc('is_my_admin'); return !error && data === true; }
    catch { return false; } // Missing migration/offline/ordinary account: fail closed.
  },
  dashboard: (range: AdminRange, page = 1, query = '') => invokeAdmin<AdminDashboard>('GET', { range, page, query }),
  inbox: (filters: { status?: string; priority?: string; category?: string; order?: string; page?: number } = {}) => invokeAdmin<AdminInbox>('GET', { section: 'feedback', ...filters }),
  action: (action: AdminAction, targetId: string, payload: Record<string, unknown> = {}) => invokeAdmin<{ updated: boolean }>('POST', {}, { action, targetId, payload }),
  updateFeedback: (id: string, changes: { status?: SupportStatus; priority?: SupportPriority; reply?: string }) => invokeAdmin<{ updated: boolean }>('POST', {}, { action: 'update_feedback', targetId: id, payload: changes }),
};

export async function submitBookezSupport(category: SupportCategory, subject: string, message: string) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Sign in to send feedback to Bookez.');
  if (!message.trim() || message.trim().length > 4000) throw new Error('Write a message of 1–4,000 characters.');
  const { error } = await supabase.from('support_tickets').insert({ user_id: user.id, category, subject: subject.trim().slice(0, 160), message: message.trim() });
  if (error) throw new Error(error.code === '22023' && error.message.includes('Please wait') ? error.message : 'Your message was not sent. Check your connection and try again.');
}

export async function readMyBookezSupport(): Promise<SupportTicket[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: tickets, error } = await supabase.from('support_tickets').select('id,user_id,category,subject,message,status,priority,created_at,updated_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5);
  if (error) throw new Error('Your recent feedback could not be loaded.');
  if (!tickets?.length) return [];
  const { data: replies, error: replyError } = await supabase.from('support_messages').select('id,ticket_id,body,created_at').in('ticket_id', tickets.map((ticket) => ticket.id)).order('created_at', { ascending: true });
  if (replyError) throw new Error('Your replies could not be loaded.');
  return tickets.map((ticket) => ({ ...ticket, category: ticket.category as SupportCategory, status: ticket.status as SupportStatus, priority: ticket.priority as SupportPriority,
    messages: (replies ?? []).filter((reply) => reply.ticket_id === ticket.id) as SupportMessage[],
  }));
}
