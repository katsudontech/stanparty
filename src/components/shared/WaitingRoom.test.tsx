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

function renderWaitingRoom(isHost: boolean) {
  return renderToStaticMarkup(createElement(WaitingRoom, {
    roomState,
    players: [host, guest],
    onlineUserIds: ['host', 'guest'],
    isHost,
    onStartGame: async () => {},
    onKickPlayer: async () => {},
    onChangeGame: async () => {}
  }));
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
