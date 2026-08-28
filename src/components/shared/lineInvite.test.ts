import { describe, expect, it } from 'vitest';

import { buildLineInviteUrl, LINE_INVITE_MESSAGE } from './lineInvite';

describe('buildLineInviteUrl', () => {
  it('ルームURLと招待文をLINEの共有URLへ設定する', () => {
    const roomUrl = 'https://stanparty.example/room/room-1?from=invite';
    const shareUrl = new URL(buildLineInviteUrl(roomUrl));

    expect(shareUrl.origin).toBe('https://social-plugins.line.me');
    expect(shareUrl.pathname).toBe('/lineit/share');
    expect(shareUrl.searchParams.get('url')).toBe(roomUrl);
    expect(shareUrl.searchParams.get('text')).toBe(LINE_INVITE_MESSAGE);
  });
});
