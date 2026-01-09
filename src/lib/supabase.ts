import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 [Supabase] URL:', supabaseUrl);
console.log('🔧 [Supabase] Anon Key:', supabaseAnonKey ? '✅ Есть' : '❌ Нет');

if (!supabaseUrl) throw new Error('Missing VITE_SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing VITE_SUPABASE_ANON_KEY');

const nativeFetch = globalThis.fetch;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: nativeFetch,
  },
  auth: {
    persistSession: true,
    storage: window.localStorage,
    storageKey: 'sb-auth-token',
    detectSessionInUrl: true,
    autoRefreshToken: true,
  },
});

console.log('Supabase client создан:', supabase);
