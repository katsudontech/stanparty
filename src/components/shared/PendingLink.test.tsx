import { createElement, type MouseEvent, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ pending: false }));
vi.mock('next/link', () => ({
  default: ({ children, href }: ComponentProps<'a'>) => createElement('a', { href }, children),
  useLinkStatus: () => ({ pending: state.pending }),
}));
import { PendingLink } from './PendingLink';
beforeEach(() => { state.pending = false; });

it('shows navigation feedback only while Next reports an in-flight transition', () => {
  const render = () => renderToStaticMarkup(createElement(PendingLink, { href: '/create_room' }, '部屋を作る'));
  expect(render()).not.toContain('移動中…');
  state.pending = true;
  expect(render()).toContain('移動中…');
  expect(render()).toContain('role="status"');
});

it('blocks duplicate navigation while preserving modified clicks for new tabs', () => {
  const link = PendingLink({ href: '/create_room' });
  const click = (detail: number, pending: boolean, ctrlKey = false) => {
    const preventDefault = vi.fn();
    link.props.onClick({ detail, ctrlKey, button: 0, preventDefault, currentTarget: { querySelector: () => pending ? {} : null } } as unknown as MouseEvent<HTMLAnchorElement>);
    return preventDefault;
  };
  expect(click(1, false)).not.toHaveBeenCalled();
  expect(click(2, false)).toHaveBeenCalledOnce();
  expect(click(0, true)).toHaveBeenCalledOnce();
  expect(click(1, true, true)).not.toHaveBeenCalled();
});
