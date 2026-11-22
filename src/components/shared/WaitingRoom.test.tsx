import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Player, RoomState } from '@/games/core/types';
import { WaitingRoom, confirmWaitingRoomKick } from './WaitingRoom';

const host: Player = {
  userId: 'host', name: 'ホスト', avatarUrl: '', isHost: true, color: '#3B82F6', isOnline: true
};
const guest: Player = {
  userId: 'guest', name: 'ゲスト', avatarUrl: '', isHost: false, color: '#10B981', isOnline: true
};
const roomState: RoomState = {
  id: 'room', host_id: 'host', game_type: 'fake-artist', status: 'waiting',
  players: [host, guest], game_state: {}, created_at: '2026-01-01T00:00:00.000Z'
};

function renderWaitingRoom(isHost: boolean, waitingPlayers = [host, guest]) {
  return renderToStaticMarkup(createElement(WaitingRoom, {
    roomState,
    players: waitingPlayers,
    onlineUserIds: ['host', 'guest'],
    isHost,
    onStartGame: async () => {},
    onKickPlayer: async () => {},
    onChangeGame: async () => {}
  }));
}

function cardNames(markup: string) {
  return [...markup.matchAll(/<h3>(.*?)<\/h3>/g)].map((match) => match[1]);
}

function playersForCount(count: number) {
  return [host, guest, ...Array.from({ length: Math.max(0, count - 2) }, (_, index) => ({
    ...guest,
    userId: `guest-${index}`,
    name: `参加者${index + 3}`,
  }))].slice(0, count);
}

describe('WaitingRoom kick control', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { confirm: vi.fn() });
  });

  it('shows a named kick action only to the host for non-host players', () => {
    const hostMarkup = renderWaitingRoom(true);
    expect(hostMarkup).toContain('ゲストさんをキック');
    expect(hostMarkup).not.toContain('ホストさんをキック');
    expect(renderWaitingRoom(false)).not.toContain('ゲストさんをキック');
  });

  it('honors confirmation cancellation and confirmation acceptance', () => {
    const confirm = vi.mocked(window.confirm);
    confirm.mockReturnValueOnce(false).mockReturnValueOnce(true);
    expect(confirmWaitingRoomKick('ゲスト')).toBe(false);
    expect(confirmWaitingRoomKick('ゲスト')).toBe(true);
    expect(confirm).toHaveBeenNthCalledWith(1, 'ゲストさんを待機ルームから退出させますか？');
  });
});

describe('WaitingRoom game selection', () => {
  it('shows the same count-prioritized catalog to hosts and guests', () => {
    const hostMarkup = renderWaitingRoom(true);
    const guestMarkup = renderWaitingRoom(false);
    const expectedOrder = ['Coyote', 'ito', 'AIにバレるな！', 'AIにバレるな！お絵かき版', 'ピンチにひらめき！', '炭酸シェイク！', 'エセ芸術家', '犯人は踊る'];

    expect(cardNames(hostMarkup)).toEqual(expectedOrder);
    expect(cardNames(guestMarkup)).toEqual(expectedOrder);
    expect(guestMarkup).toContain('ホストのみゲームを変更できます');
    expect(guestMarkup).toContain('Coyote。');
  });

  it('updates card order, guidance, and start validation as participants join or leave', () => {
    const onePlayerMarkup = renderWaitingRoom(true, playersForCount(1));
    const twoPlayerMarkup = renderWaitingRoom(true, playersForCount(2));
    const threePlayerMarkup = renderWaitingRoom(true, playersForCount(3));
    const twoPlayerAgainMarkup = renderWaitingRoom(true, playersForCount(2));
    const catalogOrder = ['エセ芸術家', 'Coyote', 'ito', 'AIにバレるな！', 'AIにバレるな！お絵かき版', 'ピンチにひらめき！', '炭酸シェイク！', '犯人は踊る'];
    const playableAtTwo = ['Coyote', 'ito', 'AIにバレるな！', 'AIにバレるな！お絵かき版', 'ピンチにひらめき！', '炭酸シェイク！', 'エセ芸術家', '犯人は踊る'];

    expect(cardNames(onePlayerMarkup)).toEqual(catalogOrder);
    expect(cardNames(twoPlayerMarkup)).toEqual(playableAtTwo);
    expect(cardNames(threePlayerMarkup)).toEqual(catalogOrder);
    expect(cardNames(twoPlayerAgainMarkup)).toEqual(playableAtTwo);
    expect(onePlayerMarkup).toContain('あと1人必要です');
    expect(twoPlayerMarkup).toContain('あと1人必要です');
    expect(twoPlayerMarkup).toContain('class="game-card game-selection-card is-selected');
    expect(twoPlayerMarkup).toContain('参加者を待っています');
    expect(threePlayerMarkup).toContain('今の3人で遊べます');
    expect(threePlayerMarkup).toContain('このゲームを開始 →');
  });
});
