import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CanvasPath } from 'react-sketch-canvas';
import { ReadOnlyDrawing } from './ReadOnlyDrawing';

describe('ReadOnlyDrawing', () => {
  it('保存済みの複数点ストロークをSVGに描画する', () => {
    const path: CanvasPath = {
      drawMode: true,
      paths: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
      strokeColor: '#123456',
      strokeWidth: 6,
    };

    const markup = renderToStaticMarkup(<ReadOnlyDrawing paths={[path]} />);

    expect(markup).toContain('<path');
    expect(markup).toContain('d="M 10,20 C');
    expect(markup).toContain('stroke="#123456"');
  });

  it('一点だけのストロークも表示する', () => {
    const path: CanvasPath = {
      drawMode: true,
      paths: [{ x: 25, y: 50 }],
      strokeColor: '#abcdef',
      strokeWidth: 8,
    };

    const markup = renderToStaticMarkup(<ReadOnlyDrawing paths={[path]} />);

    expect(markup).toContain('<circle');
    expect(markup).toContain('cx="25"');
    expect(markup).toContain('cy="50"');
    expect(markup).toContain('r="4"');
  });
});
