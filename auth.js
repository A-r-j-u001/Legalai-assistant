import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let supabase = null;
let configLoaded = false;

async function loadConfig() {
  if (configLoaded) return;
  const res = await fetch('/config', { headers: { Accept: 'application/json' } });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('Config endpoint returned non-JSON. Ensure server is restarted and /config exists.');
  }
  if (!res.ok) {
    const msg = parsed && parsed.error ? parsed.error : 'Supabase config not set';
    throw new Error(msg);
  }
  const { supabaseUrl, supabaseAnonKey } = parsed || {};
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  configLoaded = true;
}

export async function getSupabase() {
  if (!configLoaded) await loadConfig();
  return supabase;
}

export async function requireAuth() {
  const sb = await getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.replace('/login.html');
    return null;
  }
  return session;
}

export async function getUserProfile() {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { full_name: name, plan } = user.user_metadata || {};
  return { id: user.id, email: user.email, name: name || user.email, plan: plan || 'Free' };
}

export async function signInWithPassword(email, password) {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithOtp(email) {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signInWithOtp({ email });
  if (error) throw error;
  return data;
}

export async function signUp({ email, password, name, plan }) {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { full_name: name, plan } }
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const sb = await getSupabase();
  await sb.auth.signOut();
  window.location.replace('/login.html');
}
