import { describe, expect, it, vi } from 'vitest';

import { saveHintThenSelectCard } from './arranging';

describe('ito arranging interactions', () => {
  it('selects the card after its hint saves successfully', async () => {
    const saveHint = vi.fn().mockResolvedValue(undefined);
    const selectCard = vi.fn();

    await saveHintThenSelectCard('near the moon', saveHint, selectCard);

    expect(saveHint).toHaveBeenCalledWith('near the moon');
    expect(selectCard).toHaveBeenCalledOnce();
  });

  it('does not select the card when saving its hint fails', async () => {
    const saveHint = vi.fn().mockRejectedValue(new Error('save failed'));
    const selectCard = vi.fn();

    await expect(saveHintThenSelectCard('near the moon', saveHint, selectCard)).rejects.toThrow('save failed');
    expect(selectCard).not.toHaveBeenCalled();
  });
});
