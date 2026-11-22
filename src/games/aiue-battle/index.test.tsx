import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AiueBoards, AiueResult, AiueStartScreen, AiueThemeSetup, AiueWordSetup } from './index';
import { createGameState, toPrivateState } from './rules';
describe('private aiue board rendering', () => {
  it('renders eight seven-cell boards, with hidden opponent padding and visible owner padding', () => {
    const ids=['a','b','c','d','e','f','g','h'];
    const state=createGameState(ids);
    state.phase='playing';
    state.secrets=Object.fromEntries(ids.map(id=>[id,['あ','い','×','×','×','×','×']]));
    state.players.b.cells[0]='あ';
    state.lastAttack={id:'attack-shared',actorId:'a',kana:'あ',hit:true,bonus:true,revealed:{b:[0]}};
    const html=renderToStaticMarkup(createElement(AiueBoards,{state:toPrivateState(state,'a'),myUserId:'a',name:id=>id}));
    expect((html.match(/<article/g)??[])).toHaveLength(8);
    expect((html.match(/<span/g)??[])).toHaveLength(56);
    expect((html.match(/>×</g)??[])).toHaveLength(5);
    expect((html.match(/>\?</g)??[])).toHaveLength(48);
    expect(html).toContain('is-public is-flipping');
    state.phase='finished';
    const result=renderToStaticMarkup(createElement(AiueBoards,{state:toPrivateState(state,'a'),myUserId:'a',name:id=>id}));
    expect((result.match(/>×</g)??[])).toHaveLength(5);
    expect((result.match(/>\?</g)??[])).toHaveLength(48);
  });
});

describe('aiue setup readability', () => {
  it('separates the prominent candidate from the labeled custom theme input', () => {
    const html = renderToStaticMarkup(createElement(AiueThemeSetup, {
      candidate: 'コンビニにあるもの', host: true, busy: false, custom: '',
      onCustomChange: () => {}, onReroll: () => {}, onSelect: () => {},
    }));
    expect((html.match(/<section/g) ?? [])).toHaveLength(2);
    expect(html).toContain('class="aiue-theme-candidate"');
    expect(html).toContain('<strong>コンビニにあるもの</strong>');
    expect(html).toContain('for="aiue-custom-theme"');
    expect(html).toContain('id="aiue-custom-theme" class="aiue-input"');
    expect(html).toContain('このお題に決定');
    expect(html).toContain('別のお題を引く');
    const guest = renderToStaticMarkup(createElement(AiueThemeSetup, {
      candidate: '果物', host: false, busy: false, custom: '',
      onCustomChange: () => {}, onReroll: () => {}, onSelect: () => {},
    }));
    expect(guest).toContain('ホストがお題を選んでいます。');
    expect(guest).not.toContain('<input');
    expect(guest).not.toContain('<button');
  });

  it('gives partial input a neutral seven-cell preview and requires valid words to confirm', () => {
    const props = { word: 'あ', preview: null, validation: '', ready: false, myCells: null, readyCount: 0, playerCount: 8, busy: false, onChange: () => {}, onValidate: () => {}, onConfirm: () => {} };
    const partial = renderToStaticMarkup(createElement(AiueWordSetup, props));
    expect(partial).not.toContain('role="alert"');
    expect(partial).toContain('aria-invalid="false"');
    expect(partial).toContain('id="aiue-secret-word" class="aiue-input"');
    expect((partial.match(/>・</g) ?? [])).toHaveLength(7);
    expect(partial).toContain('disabled=""');
    const valid = renderToStaticMarkup(createElement(AiueWordSetup, { ...props, word: 'バナナ', preview: ['は', 'な', 'な', '×', '×', '×', '×'] }));
    expect(valid).not.toContain('disabled=""');
    expect(valid).toContain('この言葉を確定');
    expect(valid).toContain('文字の変換ルールと例');
    expect((valid.match(/>×</g) ?? [])).toHaveLength(4);
    const ready = renderToStaticMarkup(createElement(AiueWordSetup, { ...props, ready: true, readyCount: 3, myCells: ['あ', 'い', '×', '×', '×', '×', '×'] }));
    expect(ready).toContain('秘密の言葉を登録しました');
    expect(ready).toContain('3 / 8人');
    expect(ready).toContain('あなたの準備は完了です');
    expect(ready).not.toContain('<input');
    expect((ready.match(/>×</g) ?? [])).toHaveLength(5);
  });

  it('distinguishes guest host-waiting from snapshot loading and connection failure', () => {
    const props = { host: false, busy: false, snapshotAvailable: false, error: null, onInitialize: async () => {}, onRetry: () => {} };
    const waiting = renderToStaticMarkup(createElement(AiueStartScreen, props));
    expect(waiting).toContain('ホストがお題選びを始めるまでお待ちください。');
    expect(waiting).not.toContain('読み込んでいます');
    expect(waiting).not.toContain('再読み込み');
    expect(waiting).toContain('aria-current="step"');
    const loading = renderToStaticMarkup(createElement(AiueStartScreen, { ...props, snapshotAvailable: true }));
    expect(loading).toContain('ゲームを読み込んでいます');
    expect(loading).not.toContain('再読み込み');
    const failed = renderToStaticMarkup(createElement(AiueStartScreen, { ...props, snapshotAvailable: true, error: '接続できません' }));
    expect(failed).toContain('role="alert"');
    expect(failed).toContain('再読み込み');
  });

  it('labels the host result action ロビーに戻る', () => {
    const html = renderToStaticMarkup(createElement(AiueResult, { winnerName: 'あなた', host: true, onBackToLobby: () => {} }));
    expect(html).toContain('>ロビーに戻る</button>');
    expect(html).not.toContain('再戦する');
  });
});
