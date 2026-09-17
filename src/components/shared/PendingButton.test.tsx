import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PendingButton } from './PendingButton';

describe('PendingButton', () => {
  it('disables the action and announces progress without dropping form semantics', () => {
    const html = renderToStaticMarkup(createElement(PendingButton, { busy: true, type: 'submit', pendingLabel: '送信中…' }, '回答する'));
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('type="submit"');
    expect(html).toContain('role="status"');
    expect(html).toContain('送信中…');
    expect(html).not.toContain('回答する');
  });
  it('restores its label and respects other disabled reasons after finishing', () => {
    const render = (disabled = false) => renderToStaticMarkup(createElement(PendingButton, { busy: false, disabled }, '開始する'));
    expect(render()).toContain('開始する');
    expect(render()).not.toContain('disabled=""');
    expect(render(true)).toContain('disabled=""');
    expect(render()).toContain('type="button"');
  });
});

it('ignores a double-click even if the first request has already finished', () => {
  let calls = 0;
  const button = PendingButton({ busy: false, onClick: () => { calls++; } });
  const event = (detail: number) => ({ detail, preventDefault() {} }) as React.MouseEvent<HTMLButtonElement>;
  button.props.onClick(event(1));
  button.props.onClick(event(2));
  expect(calls).toBe(1);
});

it('blocks held Enter or Space without blocking unrelated keys', () => {
  let prevented = 0;
  let forwarded = 0;
  const button = PendingButton({ busy: false, onKeyDown: () => { forwarded++; } });
  for (const key of ['Enter', ' ', 'ArrowDown']) {
    button.props.onKeyDown({ repeat: true, key, preventDefault() { prevented++; } });
  }
  expect(prevented).toBe(2);
  expect(forwarded).toBe(1);
});
