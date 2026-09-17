import type { FormEvent, ReactElement, ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(), rpc: vi.fn(), push: vi.fn(),
  slots: [] as unknown[], cursor: 0,
}));
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useRef: (value: unknown) => {
    const i = mocks.cursor++;
    return mocks.slots[i] ??= { current: value };
  },
  useState: (value: unknown) => {
    const i = mocks.cursor++;
    if (!(i in mocks.slots)) mocks.slots[i] = i === 0 ? 'テストルーム' : value;
    return [mocks.slots[i], (next: unknown) => { mocks.slots[i] = next; }];
  },
  useCallback: (fn: unknown) => fn,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: () => ({ upsert: mocks.upsert }), rpc: mocks.rpc }) }));
vi.mock('@/hooks/useGuestAuth', () => ({ saveGuestDisplayProfile: () => {}, useGuestAuth: () => ({ profile: { id: 'host', name: 'ホスト', avatar: '' }, loading: false }) }));
vi.mock('@/components/shared/ProfileInput', () => ({ ProfileInput: () => null }));
vi.mock('@/components/site/SiteHeader', () => ({ SiteHeader: () => null }));
import CreateRoomPage from './page';

type Form = ReactElement<{ onSubmit: (event: FormEvent) => Promise<void> }>;
function findForm(node: ReactNode): Form | undefined {
  if (Array.isArray(node)) return node.map(findForm).find(Boolean);
  if (!node || typeof node !== 'object' || !('props' in node)) return;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (element.type === 'form') return element as Form;
  return findForm(element.props.children);
}
const renderForm = () => { mocks.cursor = 0; return findForm(CreateRoomPage())!; };
const event = { preventDefault() {} } as FormEvent;
beforeEach(() => {
  vi.clearAllMocks(); mocks.slots = []; mocks.cursor = 0;
  vi.stubGlobal('alert', vi.fn());
  mocks.rpc.mockResolvedValue({ data: 'new-room', error: null });
});

it('creates once across click/Enter and stays locked until navigation completes', async () => {
  let resolve!: (value: { error: null }) => void;
  mocks.upsert.mockImplementation(() => new Promise(yes => { resolve = yes; }));
  const form = renderForm();
  const first = form.props.onSubmit(event);
  await form.props.onSubmit(event);
  expect(mocks.upsert).toHaveBeenCalledOnce();
  resolve({ error: null });
  await first;
  expect(mocks.rpc).toHaveBeenCalledOnce();
  expect(mocks.push).toHaveBeenCalledExactlyOnceWith('/room/new-room');
  await renderForm().props.onSubmit(event);
  expect(mocks.rpc).toHaveBeenCalledOnce();
});

it('unlocks after a failed request so creation can be retried', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
  await renderForm().props.onSubmit(event);
  expect(alert).toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
  await renderForm().props.onSubmit(event);
  expect(mocks.rpc).toHaveBeenCalledTimes(2);
  expect(mocks.push).toHaveBeenCalledOnce();
  consoleError.mockRestore();
});
