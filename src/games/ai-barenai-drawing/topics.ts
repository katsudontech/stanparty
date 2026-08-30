import { AI_BARENAI_TOPICS } from '@/games/ai-barenai/topics';
export const AI_BARENAI_DRAWING_TOPICS = AI_BARENAI_TOPICS;
export function pickAiBarenaiDrawingTopic() { return AI_BARENAI_DRAWING_TOPICS[Math.floor(Math.random() * AI_BARENAI_DRAWING_TOPICS.length)]; }
