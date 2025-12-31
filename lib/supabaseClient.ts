
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string): string | undefined => {
  // 1. Check Vite's import.meta.env (Preferred)
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
    return (import.meta as any).env[key];
  }
  // 2. Check process.env (Fallback for compatibility)
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {
    // Ignore ReferenceError if process is not defined
  }
  return undefined;
};

// Default strings serve as a fallback, but Env Vars should be set in Vercel
const supabaseUrl = getEnv('VITE_SUPABASE_URL') || 'https://mrnypajnlltkuitfzgkh.supabase.co';
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ybnlwYWpubGx0a3VpdGZ6Z2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNzk2NDcsImV4cCI6MjA4MTk1NTY0N30.4kuCn5DIuZ_WHDnP66K7MxOkGunkMn_WXmuRf8g9yr8';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Key is missing. Please check your Environment Variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export async function safeFetch<T>(
  fetchFn: () => Promise<{ data: T | null; error: any }>,
  retries = 3,
  delay = 500
): Promise<{ data: T | null; error: any }> {
  try {
    const result = await fetchFn();
    
    // Check if the error returned by Supabase implies a network issue
    const isNetworkLikeError = result.error && (
      (result.error.message && result.error.message.toLowerCase().includes('fetch')) ||
      (result.error.message && result.error.message.toLowerCase().includes('network')) ||
      (result.error.message && result.error.message.toLowerCase().includes('connection')) ||
      result.error.status === 503 || // Service Unavailable
      result.error.status === 504    // Gateway Timeout
    );

    if (isNetworkLikeError && retries > 0) {
      console.warn(`Network error detected, retrying... (${retries} attempts left)`);
      await new Promise(res => setTimeout(res, delay));
      return safeFetch(fetchFn, retries - 1, delay * 2);
    }
    
    return result;
  } catch (err: any) {
    // Catch fetch exceptions (e.g., completely offline)
    const isFetchException = 
      (err.message && err.message.toLowerCase().includes('fetch')) ||
      (err.message && err.message.toLowerCase().includes('network')) ||
      !navigator.onLine;

    if (retries > 0 && isFetchException) {
      console.warn(`Fetch exception caught, retrying... (${retries} attempts left)`);
      await new Promise(res => setTimeout(res, delay));
      return safeFetch(fetchFn, retries - 1, delay * 2);
    }
    
    return { data: null, error: err };
  }
}
