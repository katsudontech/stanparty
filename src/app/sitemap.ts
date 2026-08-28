import type { MetadataRoute } from 'next';
import { GAME_CATALOG } from '@/games/catalog';
import { SITE_URL } from '@/lib/site';

const lastModified = new Date('2026-08-28T00:00:00+09:00');

const staticRoutes = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/games', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/create_room', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/join_room', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/credits', changeFrequency: 'yearly', priority: 0.3 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: new URL(route.path, SITE_URL).toString(),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const gamePages: MetadataRoute.Sitemap = GAME_CATALOG.map((game) => ({
    url: new URL(`/games/${game.id}`, SITE_URL).toString(),
    lastModified,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...pages, ...gamePages];
}
