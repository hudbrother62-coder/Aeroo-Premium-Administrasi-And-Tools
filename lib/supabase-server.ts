import 'server-only';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export const AEROO_SUPABASE_URL = 'https://hzbsdzlhjmfgtexmhccv.supabase.co';
export const AEROO_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rfEbE2jbGBvG5GbE3wTm7w_FxzAfZVm';
export const AEROO_SESSION_COOKIE = 'aeroo_session';

export function publicDb() {
  return createClient(AEROO_SUPABASE_URL, AEROO_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function sessionDb(token: string) {
  return createClient(AEROO_SUPABASE_URL, AEROO_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { 'x-aeroo-session': token } } : undefined,
  });
}

export async function db() {
  const store = await cookies();
  const token = store.get(AEROO_SESSION_COOKIE)?.value ?? '';
  return sessionDb(token);
}
