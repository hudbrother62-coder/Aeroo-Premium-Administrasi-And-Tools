import 'server-only';
import { createClient } from '@supabase/supabase-js';

const AEROO_SUPABASE_URL = 'https://hzbsdzlhjmfgtexmhccv.supabase.co';

export function db() {
  // The project URL is public metadata, so keeping a project-specific fallback
  // lets Vercel require only the server secret at runtime.
  const url = process.env.SUPABASE_URL ?? AEROO_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      'Supabase server secret is not configured. Set SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in Vercel.',
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
