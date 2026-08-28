const LINE_SHARE_ENDPOINT = 'https://social-plugins.line.me/lineit/share';

export const LINE_INVITE_MESSAGE = 'StanPartyのルームに招待します。一緒に遊ぼう！';

export function buildLineInviteUrl(roomUrl: string): string {
  return `${LINE_SHARE_ENDPOINT}?url=${encodeURIComponent(roomUrl)}&text=${encodeURIComponent(LINE_INVITE_MESSAGE)}`;
}
