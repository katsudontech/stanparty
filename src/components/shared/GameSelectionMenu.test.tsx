import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  cursor: 0,
  idCursor: 0,
  effects: [] as Array<() => void>,
  slots: [] as unknown[],
  refs: [] as Array<{ current: unknown }>,
}));

vi.mock('react', () => ({
  useEffect: (effect: () => void) => harness.effects.push(effect),
  useId: () => `test-id-${harness.idCursor++}`,
  useRef: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) {
      harness.slots[index] = { current: initial };
    }
    const ref = harness.slots[index] as { current: unknown };
    harness.refs[index] = ref;
    return ref;
  },
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [harness.slots[index], (next: unknown) => { harness.slots[index] = next; }];
  },
}));

vi.mock('@/components/site/GameArtwork', () => ({ GameArtwork: () => null }));

import { GAME_CATALOG, sortGamesByPlayerCount } from '@/games/catalog';
import { GameSelectionMenu } from './GameSelectionMenu';

type ElementNode = {
  props?: Record<string, unknown>;
  type?: unknown;
};

const allGames = GAME_CATALOG.slice(0, 4);
const gamesAtCountTwo = sortGamesByPlayerCount(allGames, 2);
const gamesAtCountThree = sortGamesByPlayerCount(allGames, 3);
const noop = async () => true;

function collect(node: unknown, predicate: (element: ElementNode) => boolean): ElementNode[] {
  if (!node || typeof node !== 'object') return [];

  const element = node as ElementNode;
  const matches = element.props && predicate(element) ? [element] : [];
  const children = element.props?.children;
  const childNodes = Array.isArray(children) ? children : [children];
  return matches.concat(...childNodes.map((child) => collect(child, predicate)));
}

function buttons(root: unknown) {
  return collect(root, (element) => element.props?.className === 'game-selection-card__button');
}

function buttonFor(root: unknown, gameId: string) {
  const button = buttons(root).find((candidate) => String(candidate.props?.['aria-label']).startsWith(
    GAME_CATALOG.find((game) => game.id === gameId)?.shortName ?? gameId,
  ));
  if (!button) throw new Error(`Missing button for ${gameId}`);
  return button;
}

function render(props: Partial<Parameters<typeof GameSelectionMenu>[0]> = {}) {
  harness.cursor = 0;
  harness.idCursor = 0;
  harness.effects = [];
  return GameSelectionMenu({
    games: gamesAtCountTwo,
    playerCount: 2,
    value: 'fake-artist',
    onChange: noop,
    ...props,
  });
}

function bindOptionNodes(root: unknown, active: { current: FakeButton | null }, nodeCache: Map<string, FakeButton>) {
  buttons(root).forEach((element) => {
    const ref = element.props?.ref as ((node: FakeButton | null) => void) | undefined;
    const label = String(element.props?.['aria-label']);
    const gameId = GAME_CATALOG.find((game) => label.startsWith(game.shortName))?.id ?? label;
    const node = nodeCache.get(gameId) ?? new FakeButton(label);
    nodeCache.set(gameId, node);
    node.onFocus = () => { active.current = node; };
    ref?.(node);
  });
}

function runLatestEffect() {
  harness.effects.at(-1)?.();
}

class FakeButton {
  public onFocus = () => {};
  public focusCalls = 0;

  constructor(public readonly label: string) {}

  focus() {
    this.focusCalls++;
    this.onFocus();
  }
}

const dialog = {
  open: false,
  showModal: vi.fn(() => { dialog.open = true; }),
  close: vi.fn(() => { dialog.open = false; }),
};

beforeEach(() => {
  harness.cursor = 0;
  harness.idCursor = 0;
  harness.effects = [];
  harness.slots = [];
  harness.refs = [];
  dialog.open = false;
  dialog.showModal.mockClear();
  dialog.close.mockClear();
});

describe('GameSelectionMenu interaction state', () => {
  it('opens with the selected game focused and keeps focus on that game through reorder', () => {
    const active = { current: null as FakeButton | null };
    const nodeCache = new Map<string, FakeButton>();
    const onChange = vi.fn().mockResolvedValue(true);
    const closed = render({ onChange });
    harness.refs[3].current = dialog;
    const trigger = collect(closed, (element) => String(element.props?.className).startsWith('form-select'))[0];
    (trigger.props?.onClick as () => void)();

    const opened = render({ onChange });
    bindOptionNodes(opened, active, nodeCache);
    runLatestEffect();
    const selected = active.current;
    expect(selected?.label).toContain('エセ芸術家');
    expect(selected?.focusCalls).toBe(1);

    const focusedBeforeReorder = buttonFor(opened, 'coyote');
    const coyote = nodeCache.get('coyote');
    if (!coyote) throw new Error('Missing coyote node');
    coyote.focus();
    const callsBeforeReorder = coyote.focusCalls;

    const reordered = render({ games: gamesAtCountThree, playerCount: 3, onChange });
    bindOptionNodes(reordered, active, nodeCache);
    runLatestEffect();
    expect(active.current).toBe(coyote);
    expect(coyote.focusCalls).toBe(callsBeforeReorder);
    expect(buttonFor(reordered, 'fake-artist').props?.['aria-pressed']).toBe(true);
    expect(focusedBeforeReorder.props?.['aria-pressed']).toBe(false);

    const restored = render({ games: gamesAtCountTwo, playerCount: 2, onChange });
    bindOptionNodes(restored, active, nodeCache);
    runLatestEffect();
    expect(active.current).toBe(coyote);
    expect(buttonFor(restored, 'fake-artist').props?.['aria-pressed']).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('navigates the current visual order with next, previous, Home, and End', () => {
    const active = { current: null as FakeButton | null };
    const nodeCache = new Map<string, FakeButton>();
    const root = render();
    harness.refs[3].current = dialog;
    bindOptionNodes(root, active, nodeCache);
    const coyote = buttonFor(root, 'coyote');
    const ito = buttonFor(root, 'ito');
    const event = (key: string) => ({ key, preventDefault: vi.fn() });

    (coyote.props?.onKeyDown as (event: unknown) => void)(event('ArrowDown'));
    expect(active.current?.label).toContain('ito');
    (ito.props?.onKeyDown as (event: unknown) => void)(event('ArrowUp'));
    expect(active.current?.label).toContain('Coyote');
    (coyote.props?.onKeyDown as (event: unknown) => void)(event('End'));
    expect(active.current?.label).toContain('エセ芸術家');
    const fakeArtist = buttonFor(root, 'fake-artist');
    (fakeArtist.props?.onKeyDown as (event: unknown) => void)(event('Home'));
    expect(active.current?.label).toContain('Coyote');

    const reordered = render({ games: gamesAtCountThree, playerCount: 3 });
    bindOptionNodes(reordered, active, nodeCache);
    const reorderedCoyote = buttonFor(reordered, 'coyote');
    (reorderedCoyote.props?.onKeyDown as (event: unknown) => void)(event('Home'));
    expect(active.current?.label).toContain('エセ芸術家');
    const reorderedFakeArtist = buttonFor(reordered, 'fake-artist');
    (reorderedFakeArtist.props?.onKeyDown as (event: unknown) => void)(event('End'));
    expect(active.current?.label).toContain('AIにバレるな！');
  });

  it('keeps a mismatched game host-selectable, blocks guests, and preserves errors or failed changes', async () => {
    const onChange = vi.fn().mockResolvedValue(false);
    const root = render({ onChange, value: 'coyote' });
    const mismatched = buttonFor(root, 'fake-artist');
    expect(mismatched.props?.disabled).toBe(false);
    expect(mismatched.props?.['aria-label']).toContain('あと1人必要です');
    const trigger = collect(root, (element) => String(element.props?.className).startsWith('form-select'))[0];
    (trigger.props?.onClick as () => void)();
    const opened = render({ onChange, value: 'coyote' });
    const openedMismatched = buttonFor(opened, 'fake-artist');
    await (openedMismatched.props?.onClick as () => Promise<void>)();
    expect(onChange).toHaveBeenCalledWith('fake-artist');
    expect(harness.slots[0]).toBe(true);

    const guestChange = vi.fn().mockResolvedValue(true);
    const guestRoot = render({ browseOnly: true, onChange: guestChange, value: 'coyote' });
    const guestButton = buttonFor(guestRoot, 'fake-artist');
    await (guestButton.props?.onClick as () => Promise<void>)();
    expect(guestChange).not.toHaveBeenCalled();
    expect(guestButton.props?.['aria-disabled']).toBe(true);

    const busyErrorRoot = render({ busy: true, error: '変更できません', value: 'coyote' });
    expect(collect(busyErrorRoot, (element) => element.props?.disabled === true)).not.toHaveLength(0);
    expect(collect(busyErrorRoot, (element) => element.props?.role === 'alert')).not.toHaveLength(0);
    expect(collect(busyErrorRoot, (element) => element.props?.role === 'status')).not.toHaveLength(0);
    expect(collect(busyErrorRoot, (element) => element.props?.className === 'game-selection-card__button')).toHaveLength(4);
  });
});

function changeFilter(root: unknown, index: number, value: string) {
  const select = collect(root, (element) => element.type === 'select')[index];
  (select.props?.onChange as (event: unknown) => void)({ target: { value } });
}

describe('game selection filters', () => {
  it('combines independent filters, preserves selection, and resets an empty result', () => {
    const onChange = vi.fn();
    let root = render({ onChange });
    changeFilter(root, 0, 'お絵描き');
    root = render({ onChange });
    expect(buttons(root)).toHaveLength(1);
    expect(buttonFor(root, 'fake-artist').props?.['aria-pressed']).toBe(true);
    changeFilter(root, 1, 'in-person');
    root = render({ onChange });
    expect(buttons(root)).toHaveLength(0);
    expect(collect(root, (element) => String(element.props?.children).includes('条件に合うゲームがありません'))).not.toHaveLength(0);
    const reset = collect(root, (element) => element.type === 'button' && element.props?.children === '絞り込みをリセット')[0];
    (reset.props?.onClick as () => void)();
    root = render({ onChange });
    expect(buttons(root)).toHaveLength(4);
    expect(buttonFor(root, 'fake-artist').props?.['aria-pressed']).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('filters online games in the supplied player-count order and navigates only visible cards', () => {
    let root = render();
    changeFilter(root, 1, 'online');
    root = render();
    expect(buttons(root)).toHaveLength(3);
    const active = { current: null as FakeButton | null };
    bindOptionNodes(root, active, new Map());
    const first = buttonFor(root, 'ito');
    (first.props?.onKeyDown as (event: unknown) => void)({ key: 'ArrowUp', preventDefault: vi.fn() });
    expect(active.current?.label).toContain('エセ芸術家');
    changeFilter(root, 0, '協力');
    root = render();
    expect(buttons(root)).toHaveLength(2);
    expect(buttons(root)[0].props?.['aria-label']).toContain('ito');
  });

  it('reopens with the first visible card focused when the selection is hidden', () => {
    let root = render();
    harness.refs[3].current = dialog;
    changeFilter(root, 1, 'in-person');
    root = render();
    const trigger = collect(root, (element) => element.props?.['aria-haspopup'] === 'dialog')[0];
    (trigger.props?.onClick as () => void)();
    root = render();
    const active = { current: null as FakeButton | null };
    bindOptionNodes(root, active, new Map());
    runLatestEffect();
    expect(active.current?.label).toContain('Coyote');
  });
});
