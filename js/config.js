import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://cvdrewujvyxsmpbnswtw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bdWg4K4V29MNj5SLtVlImA_1cpcogD1';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
