export interface AvatarTemplate {
  id: string;
  label: string;
  url: string;
}

const createAvatarUrl = (seed: string) =>
  `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;

export const AVATAR_TEMPLATES: readonly AvatarTemplate[] = [
  { id: 'sunny', label: 'サニー', url: createAvatarUrl('stanparty-sunny') },
  { id: 'moon', label: 'ムーン', url: createAvatarUrl('stanparty-moon') },
  { id: 'star', label: 'スター', url: createAvatarUrl('stanparty-star') },
  { id: 'cloud', label: 'クラウド', url: createAvatarUrl('stanparty-cloud') },
  { id: 'berry', label: 'ベリー', url: createAvatarUrl('stanparty-berry') },
  { id: 'mint', label: 'ミント', url: createAvatarUrl('stanparty-mint') },
  { id: 'peach', label: 'ピーチ', url: createAvatarUrl('stanparty-peach') },
  { id: 'soda', label: 'ソーダ', url: createAvatarUrl('stanparty-soda') },
];

export function getDefaultAvatarUrl(userId: string): string {
  let hash = 0;

  for (const character of userId) {
    hash = ((hash * 31) + (character.codePointAt(0) ?? 0)) >>> 0;
  }

  return AVATAR_TEMPLATES[hash % AVATAR_TEMPLATES.length].url;
}
