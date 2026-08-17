import type { SupabaseClient } from '@supabase/supabase-js';

export async function authenticateRealtime(
  supabase: SupabaseClient,
  expectedUserId?: string
): Promise<void> {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) throw error;
  if (!session) throw new Error('Authenticated session is required for Realtime.');
  if (expectedUserId && session.user.id !== expectedUserId) {
    throw new Error('Realtime session does not match the current player.');
  }

  await supabase.realtime.setAuth(session.access_token);
}
