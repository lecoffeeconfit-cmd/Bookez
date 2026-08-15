import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { bookezSecureStorage } from './secure-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Add them to the local environment before starting Bookez.');
}

export const bookezRedirectUrl = 'bookez://auth/callback';
export const bookezEmailConfirmationRedirectUrl = 'https://bookez-email-confirmation.lecoffeeconfit888.chatgpt.site';

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  db: { schema: 'bookez' },
  auth: {
    storage: bookezSecureStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: { headers: { 'x-bookez-client': 'bookez-expo' } },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
