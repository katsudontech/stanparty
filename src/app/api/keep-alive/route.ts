import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

class KeepAliveConfigurationError extends Error {}

function isAuthorized(request: Request): boolean {
  const expectedSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');
  const token = authorization?.match(/^Bearer[ \t]+([^ \t]+)$/i)?.[1];

  if (!expectedSecret || !token) return false;

  const providedBytes = Buffer.from(token);
  const expectedBytes = Buffer.from(expectedSecret);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new KeepAliveConfigurationError();

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = serviceClient();
    const { error } = await supabase.from('rooms').select('id').limit(1);
    if (error) {
      return Response.json({ error: 'Keep-alive query failed' }, { status: 503 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof KeepAliveConfigurationError) {
      return Response.json({ error: 'Keep-alive is not configured' }, { status: 500 });
    }

    return Response.json({ error: 'Keep-alive query failed' }, { status: 503 });
  }
}
