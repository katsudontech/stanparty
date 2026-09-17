import { beforeEach, describe, expect, it, vi } from 'vitest';

// A persistent hook state harness: explicitly re-render to verify the ref blocks
// the second event even before React has committed the pending state.
const harness = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));
vi.mock('react', () => ({
  useRef: (value: unknown) => {
    const index = harness.cursor++;
    return harness.slots[index] ??= { current: value };
  },
  useState: (value: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = value;
    return [harness.slots[index], (next: unknown) => { harness.slots[index] = next; }];
  },
  useCallback: (callback: unknown) => callback,
}));
import { useAsyncAction } from './useAsyncAction';

// This is a simulated hook renderer, not a React component; reset its slot cursor.
// eslint-disable-next-line react-hooks/immutability
const Harness = () => { harness.cursor = 0; return useAsyncAction(); };
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => { harness.slots = []; harness.cursor = 0; });

describe('async button actions', () => {
  it('blocks a second click and competing action before rerender, then allows retry', async () => {
    const request = deferred();
    const save = vi.fn(() => request.promise);
    const competingAction = vi.fn();
    const action = Harness();
    const first = action.run(save);
    await expect(action.run(save)).resolves.toBe(false);
    await expect(action.run(competingAction)).resolves.toBe(false);
    expect(save).toHaveBeenCalledOnce();
    expect(competingAction).not.toHaveBeenCalled();
    expect(Harness().pending).toBe(true);
    // The lock also survives a new render and new event-handler closure.
    await expect(Harness().run(save)).resolves.toBe(false);
    request.resolve();
    await expect(first).resolves.toBe(true);
    expect(Harness().pending).toBe(false);
    await expect(Harness().run(competingAction)).resolves.toBe(true);
    expect(competingAction).toHaveBeenCalledOnce();
  });

  it('shows a rejection, releases pending, and clears the error on retry', async () => {
    const request = deferred();
    const first = Harness().run(() => request.promise);
    request.reject(new Error('通信できませんでした'));
    await expect(first).resolves.toBe(false);
    expect(Harness()).toMatchObject({ pending: false, error: '通信できませんでした' });
    const retry = deferred();
    const second = Harness().run(() => retry.promise);
    expect(Harness()).toMatchObject({ pending: true, error: null });
    retry.resolve();
    await second;
    expect(Harness().pending).toBe(false);
  });

  it('recovers even from synchronous throws and non-Error rejections', async () => {
    await expect(Harness().run(() => { throw 'offline'; })).resolves.toBe(false);
    expect(Harness().pending).toBe(false);
    expect(Harness().error).toContain('もう一度');
    await expect(Harness().run(() => {})).resolves.toBe(true);
  });
});
