import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));

import { POST } from './route';

const roomId = '00000000-0000-4000-8000-000000000001';
const actorId = '00000000-0000-4000-8000-000000000002';
const otherId = '00000000-0000-4000-8000-000000000003';
const makeRequest = (body: unknown, authorization = 'Bearer valid-token') => new Request('https://stanparty.example/api/room-reactions', {
  method: 'POST', headers: { authorization, 'content-type': 'application/json' }, body: JSON.stringify(body),
});

describe('POST /api/room-reactions', () => {
  let testTime = Date.now();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    testTime += 60_001;
    vi.setSystemTime(testTime);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
    mocks.getUser.mockResolvedValue({ data: { user: { id: actorId } }, error: null });
    mocks.maybeSingle.mockResolvedValue({ data: {
      host_id: otherId,
      players: [{ userId: actorId, name: 'Alice' }, { userId: otherId, name: 'Host' }],
    }, error: null });
    mocks.createClient.mockImplementation((_url, key) => key === 'anon-key'
      ? { auth: { getUser: mocks.getUser } }
      : { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }) });
    mocks.fetch.mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', mocks.fetch);
  });

  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('rejects missing or invalid authentication before accessing the room', async () => {
    const response = await POST(makeRequest({ roomId, emoji: '👏' }, ''));
    expect(response.status).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('rejects a non-member and never broadcasts to the room', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: '00000000-0000-4000-8000-000000000099' } }, error: null });
    const response = await POST(makeRequest({ roomId, emoji: '👏' }));
    expect(response.status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('rejects an invalid token before querying room membership', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('Invalid JWT') });
    expect((await POST(makeRequest({ roomId, emoji: '👏' }))).status).toBe(401);
    expect(mocks.getUser).toHaveBeenCalledWith('valid-token');
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('uses the roster name for the authenticated actor and ignores spoofed fields', async () => {
    const response = await POST(makeRequest({ roomId, emoji: '👏', senderId: otherId, senderName: 'Host' }));
    expect(response.status).toBe(200);
    const requestBody = JSON.parse(mocks.fetch.mock.calls[0][1].body as string) as { messages: Array<{ topic: string; private: boolean; payload: Record<string, unknown> }> };
    expect(requestBody.messages).toHaveLength(2);
    expect(requestBody.messages[0].payload.senderId).toBe(actorId);
    expect(requestBody.messages[0].payload.senderName).toBe('Alice');
    expect(requestBody.messages[0].payload.emoji).toBe('👏');
    expect(requestBody.messages.map(({ topic }) => topic)).toEqual([`room-reactions:${roomId}:${actorId}`, `room-reactions:${roomId}:${otherId}`]);
    expect(requestBody.messages.every((message) => message.private)).toBe(true);
    expect(requestBody.messages[0].payload.id).toBe(requestBody.messages[1].payload.id);
    expect(mocks.fetch.mock.calls[0][1].headers.authorization).toBe('Bearer service-role-key');
  });

  it('rejects bad formats before querying Supabase', async () => {
    const response = await POST(makeRequest({ roomId: 'bad', emoji: '🔥' }));
    expect(response.status).toBe(400);
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
  });

  it('limits repeated sends and permits a new send after one second', async () => {
    expect((await POST(makeRequest({ roomId, emoji: '👏' }))).status).toBe(200);
    expect((await POST(makeRequest({ roomId, emoji: '😂' }))).status).toBe(429);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1_000);
    expect((await POST(makeRequest({ roomId, emoji: '😂' }))).status).toBe(200);
  });

  it('only targets the current roster and reports Broadcast failures', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { host_id: actorId, players: [{ userId: actorId, name: 'Alice' }] }, error: null });
    mocks.fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    expect((await POST(makeRequest({ roomId, emoji: '👏' }))).status).toBe(502);
    const body = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].topic).toBe(`room-reactions:${roomId}:${actorId}`);
    expect(vi.getTimerCount()).toBe(0);
  });
});
