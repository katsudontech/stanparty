import { describe, expect, it } from 'vitest';

import { beforeSend } from './WebAnalytics';

describe('WebAnalytics beforeSend', () => {
  it('drops pageviews and custom events for invitation rooms', () => {
    expect(beforeSend({ type: 'pageview', url: 'https://stanparty.example/room/abc123' })).toBeNull();
    expect(beforeSend({ type: 'event', url: 'https://stanparty.example/room/abc123' })).toBeNull();
  });

  it('keeps non-room events and rejects malformed URLs', () => {
    const event = { type: 'pageview' as const, url: 'https://stanparty.example/privacy' };

    expect(beforeSend(event)).toBe(event);
    expect(beforeSend({ type: 'event', url: 'https://' })).toBeNull();
  });
});
