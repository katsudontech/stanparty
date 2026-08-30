import { describe, expect, it } from 'vitest';
import { canResetDrawing, selectDrawingWinner } from './rules';

describe('AIにバレるな！お絵かき版', () => {
  it('リセットは描画中の描く人だけが実行できる', () => {
    expect(canResetDrawing('drawing', 'drawer', 'drawer', null)).toBe(true);
    expect(canResetDrawing('drawing', 'answerer', 'drawer', null)).toBe(false);
    expect(canResetDrawing('answering', 'drawer', 'drawer', null)).toBe(false);
    expect(canResetDrawing('revealing', 'drawer', 'drawer', null)).toBe(false);
    expect(canResetDrawing('game_over', 'drawer', 'drawer', null)).toBe(false);
    expect(canResetDrawing('drawing', 'drawer', 'drawer', 3)).toBe(false);
  });

  it('AIの正解を常に優先する', () => {
    expect(selectDrawingWinner(true, true)).toBe('ai');
    expect(selectDrawingWinner(true, false)).toBe('humans');
    expect(selectDrawingWinner(false, false)).toBe('draw');
  });
});
