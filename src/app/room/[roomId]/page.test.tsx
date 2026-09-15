import { beforeEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const state = vi.hoisted(() => ({ userId: null as string | null, game: 'fake-artist', status: 'playing' }));
beforeEach(() => { state.userId = null; state.game = 'fake-artist'; state.status = 'playing'; });

vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  use: () => ({ roomId: 'room' }),
}));
vi.mock('@/hooks/useGuestAuth', () => ({
  useGuestAuth: () => ({ profile: state.userId ? { id: state.userId } : null, loading: false, error: state.userId ? null : new Error('Network unavailable') }),
}));
vi.mock('@/hooks/useRoomSubscription', () => ({
  useRoomSubscription: () => ({ roomState: { host_id: 'host', players: [{ userId: 'guest' }], game_type: state.game, status: state.status }, players: [], onlineUserIds: [], loading: false, error: null }),
}));
vi.mock('@/hooks/useHostAutoKick', () => ({ useHostAutoKick: () => {} }));
vi.mock('@/hooks/useRoomControls', () => ({ useRoomControls: () => ({ handleBackToLobby: async () => {} }) }));
vi.mock('@/components/shared/JoinRoomScreen', () => ({ JoinRoomScreen: () => null }));
vi.mock('@/components/shared/WaitingRoom', () => ({ WaitingRoom: ({ headerActions }: { headerActions?: import('react').ReactNode }) => headerActions }));
vi.mock('@/games/core/GameWrapper', () => ({ GameWrapper: ({ headerActions }: { headerActions?: import('react').ReactNode }) => headerActions }));
vi.mock('@/games/fake-artist', () => ({ FakeArtistGame: () => null }));
vi.mock('@/games/coyote', () => ({ CoyoteGame: () => null }));
vi.mock('@/games/one-night-werewolf', () => ({ OneNightWerewolfGame: () => null }));
vi.mock('@/games/ito', () => ({ ItoGame: () => null }));
vi.mock('@/games/ai-barenai', () => ({ AiBarenaiGame: () => null }));
vi.mock('@/games/ai-barenai-drawing', () => ({ AiBarenaiDrawingGame: () => null }));
vi.mock('@/games/pinch-hint', () => ({ PinchHintGame: ({ headerActions }: { headerActions?: import('react').ReactNode }) => headerActions }));
import RoomPage from './page';

it('shows a retry action instead of an endless spinner when authentication fails', () => {
  const html = renderToStaticMarkup(createElement(RoomPage, { params: Promise.resolve({ roomId: 'room' }) }));
  expect(html).toContain('接続できませんでした');
  expect(html).toContain('再試行する');
  expect(html).not.toContain('ルームを読み込んでいます');
});

const games = ['fake-artist', 'coyote', 'one-night-werewolf', 'ito', 'ai-barenai', 'ai-barenai-drawing', 'pinch-hint'];
it.each(games)('shows the end button only to the host in %s', (game) => {
  state.game = game;
  state.userId = 'host';
  const render = () => renderToStaticMarkup(createElement(RoomPage, { params: Promise.resolve({ roomId: 'room' }) }));
  expect(render()).toContain('ゲームを終了して待機ルームへ戻る');
  expect(render()).toContain('aria-label="リアクションを送る"');
  state.userId = 'guest';
  expect(render()).not.toContain('ゲームを終了して待機ルームへ戻る');
  expect(render()).toContain('aria-label="リアクションを送る"');
});
it('does not show the end button in the waiting room', () => {
  state.userId = 'host';
  state.status = 'waiting';
  const html = renderToStaticMarkup(createElement(RoomPage, { params: Promise.resolve({ roomId: 'room' }) }));
  expect(html).not.toContain('ゲームを終了して待機ルームへ戻る');
  expect(html).toContain('aria-label="リアクションを送る"');
});

it('keeps reaction and host controls available in the finished fallback', () => {
  state.userId = 'host';
  state.status = 'finished';
  const html = renderToStaticMarkup(createElement(RoomPage, { params: Promise.resolve({ roomId: 'room' }) }));
  expect(html).toContain('aria-label="リアクションを送る"');
  expect(html).toContain('ゲームを終了して待機ルームへ戻る');
});

it('does not mount reaction controls before joining a room', () => {
  state.userId = 'outsider';
  const html = renderToStaticMarkup(createElement(RoomPage, { params: Promise.resolve({ roomId: 'room' }) }));
  expect(html).not.toContain('リアクションを送る');
});
