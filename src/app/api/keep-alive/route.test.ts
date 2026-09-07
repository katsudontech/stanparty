import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: supabaseMocks.createClient,
}));

import { GET } from './route';

const request = (authorization?: string) => new Request('https://stanparty.example/api/keep-alive', {
  headers: authorization ? { authorization } : undefined,
});

describe('GET /api/keep-alive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'cron-test-secret');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-test-key');
    supabaseMocks.limit.mockResolvedValue({ data: [], error: null });
    supabaseMocks.select.mockReturnValue({ limit: supabaseMocks.limit });
    supabaseMocks.from.mockReturnValue({ select: supabaseMocks.select });
    supabaseMocks.createClient.mockReturnValue({ from: supabaseMocks.from });
  });

  it('rejects requests without the cron secret', async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(supabaseMocks.createClient).not.toHaveBeenCalled();
  });

  it('rejects requests with a mismatched cron secret', async () => {
    const response = await GET(request('Bearer wrong-secret'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(supabaseMocks.createClient).not.toHaveBeenCalled();
  });

  it('queries rooms and returns success for the correct cron secret', async () => {
    const response = await GET(request('Bearer cron-test-secret'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(supabaseMocks.createClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'service-role-test-key',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    expect(supabaseMocks.from).toHaveBeenCalledWith('rooms');
    expect(supabaseMocks.select).toHaveBeenCalledWith('id');
    expect(supabaseMocks.limit).toHaveBeenCalledWith(1);
  });

  it('returns a generic service-unavailable response when Supabase fails', async () => {
    supabaseMocks.limit.mockResolvedValue({ data: null, error: { message: 'database details' } });

    const response = await GET(request('Bearer cron-test-secret'));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Keep-alive query failed' });
  });

  it('returns a generic configuration error without querying when Supabase settings are missing', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    const response = await GET(request('Bearer cron-test-secret'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Keep-alive is not configured' });
    expect(supabaseMocks.createClient).not.toHaveBeenCalled();
  });
});
