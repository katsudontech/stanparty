import { describe, expect, it } from 'vitest';

import manifest from './manifest';

describe('web app manifest', () => {
  it('opens the native-feeling app home without changing the app scope or identity', () => {
    const result = manifest();

    expect(result.start_url).toBe('/app');
    expect(result.scope).toBe('/');
    expect(result.id).toBe('/');
  });
});
