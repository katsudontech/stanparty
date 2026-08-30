import type { MetadataRoute } from "next";

const description =
  "スマホひとつで友達と遊べる、リアルタイムのパーティゲーム。アカウント登録なしですぐに始められます。";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "StanParty｜待ち時間を、遊ぶ時間に。",
    short_name: "StanParty",
    description,
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f4f0e6",
    theme_color: "#f4f0e6",
    lang: "ja",
    categories: ["games", "entertainment", "social"],
    icons: [
      {
        src: "/pwa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "部屋をつくる",
        short_name: "部屋作成",
        description: "新しいパーティゲームの部屋を作成します。",
        url: "/create_room",
      },
      {
        name: "部屋を探す",
        short_name: "部屋検索",
        description: "参加できるパーティゲームの部屋を探します。",
        url: "/join_room",
      },
    ],
  };
}
