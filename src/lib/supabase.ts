import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const CARD_IMAGES_BUCKET = 'card-images';

function readViteEnv(key: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  try {
    const env = (import.meta as { env?: Record<string, string | undefined> }).env;
    return (env?.[key] ?? '').trim();
  } catch {
    return '';
  }
}

export function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = readViteEnv('VITE_SUPABASE_URL');
  const anonKey = readViteEnv('VITE_SUPABASE_ANON_KEY');

  if (!url || !anonKey) return null;
  if (!/^https?:\/\/.+/i.test(url)) return null;
  if (
    anonKey === 'MY_SUPABASE_ANON_KEY' ||
    anonKey === 'YOUR_SUPABASE_ANON_KEY' ||
    url.includes('MY_SUPABASE_URL') ||
    url.includes('YOUR_SUPABASE_URL')
  ) {
    return null;
  }
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

let cachedClient: SupabaseClient | null = null;
let cachedKeySignature = '';

export function getSupabaseClient(): SupabaseClient | null {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;

  const signature = `${cfg.url}|${cfg.anonKey}`;
  if (cachedClient && cachedKeySignature === signature) {
    return cachedClient;
  }

  cachedClient = createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
  cachedKeySignature = signature;
  return cachedClient;
}
