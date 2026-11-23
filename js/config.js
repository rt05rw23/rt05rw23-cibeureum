import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Ganti dengan URL dan Anon Key dari dashboard Supabase Anda
const SUPABASE_URL = 'https://cvdrewujvyxsmpbnswtw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bdWg4K4V29MNj5SLtVlImA_1cpcogD1';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);