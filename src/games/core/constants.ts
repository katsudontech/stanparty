// プレイヤーのテーマカラーのパレット
// Tailwind CSSの色合いをベースにした、視認性が高く被りにくい10色
export const PLAYER_COLORS = [
  // 鮮やかなメインカラー（1〜10人目）
  '#ef4444', // Red 500
  '#3b82f6', // Blue 500
  '#10b981', // Emerald 500
  '#f59e0b', // Amber 500
  '#8b5cf6', // Violet 500
  '#ec4899', // Pink 500
  '#06b6d4', // Cyan 500
  '#f97316', // Orange 500
  '#14b8a6', // Teal 500
  '#6366f1', // Indigo 500

  // 追加カラーバリエーション（11〜20人目）
  '#84cc16', // Lime 500
  '#eab308', // Yellow 500
  '#f43f5e', // Rose 500
  '#d946ef', // Fuchsia 500
  '#0ea5e9', // Sky 500
  '#22c55e', // Green 500
  '#a855f7', // Purple 500
  '#78716c', // Stone 500
  '#64748b', // Slate 500
  '#fbbf24', // Amber 400
];

// 参加順（インデックス）から色を取得する関数
// 人数がパレット数（10人）を超えた場合はループする
export const getPlayerColor = (index: number): string => {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
};
