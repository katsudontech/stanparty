import { createClient } from '@/lib/supabase/client';
import { type FakeArtistGameState, type RuleSettings, type FakeArtistPlayerState, type FakeArtistPhase, DEFAULT_FAKE_ARTIST_STATE } from '../types';
import type { Player, RoomState } from '@/games/core/types';

export const THEMES = [
  { genre: '動物', themes: ['犬', '猫', 'ライオン', 'ゾウ', 'キリン', 'パンダ', 'コアラ', 'ゴリラ'] },
  { genre: '食べ物', themes: ['りんご', 'ハンバーガー', '寿司', 'ラーメン', 'ピザ', 'オムライス', 'カレー', 'たこ焼き'] },
  { genre: '乗り物', themes: ['車', '飛行機', '新幹線', '自転車', '船', 'バス', 'ヘリコプター', 'トラック'] },
  { genre: 'スポーツ', themes: ['野球', 'サッカー', 'テニス', 'バスケットボール', '水泳', '卓球', 'バレーボール'] },
  { genre: '場所', themes: ['学校', '病院', '公園', '遊園地', '映画館', '動物園', '水族館', '温泉'] },
];

export function getRandomTheme() {
  const genreObj = THEMES[Math.floor(Math.random() * THEMES.length)];
  const theme = genreObj.themes[Math.floor(Math.random() * genreObj.themes.length)];
  return { genre: genreObj.genre, theme };
}

export function useFakeArtistGame(roomState: RoomState) {
  const supabase = createClient();
  const roomId = roomState.id;
  const players = roomState.players;
  const currentGameState = roomState.game_state as FakeArtistGameState | null;

  // ゲームステートの部分更新をラップする便利関数
  const updateGameState = async (newStatePartial: Partial<FakeArtistGameState>) => {
    const baseState = currentGameState || DEFAULT_FAKE_ARTIST_STATE;
    const updatedState = { ...baseState, ...newStatePartial };

    const { error } = await supabase
      .from('rooms')
      .update({ game_state: updatedState })
      .eq('id', roomId);

    if (error) {
      console.error('ゲーム状態の更新に失敗しました:', error);
    }
  };

  // 役職をランダムに割り当てるロジック
  const generateRoles = (rules: RuleSettings): Record<string, FakeArtistPlayerState> => {
    // プレイヤーのIDリストをシャッフル
    const shuffledIds = [...players].map(p => p.userId).sort(() => Math.random() - 0.5);
    const playerStates: Record<string, FakeArtistPlayerState> = {};

    // 全員を一旦初期化
    players.forEach(p => {
      playerStates[p.userId] = { role: null, color: p.color, score: 0 };
    });

    if (rules.autoThemeSelection) {
      // 自動お題選択（出題者なし）の場合：1人目がエセ、残りが芸術家
      shuffledIds.forEach((id, index) => {
        if (index === 0) playerStates[id].role = 'fake_artist';
        else playerStates[id].role = 'artist';
      });
    } else {
      // 出題者ありの場合：1人目が出題者、2人目がエセ、残りが芸術家
      shuffledIds.forEach((id, index) => {
        if (index === 0) playerStates[id].role = 'questioner';
        else if (index === 1) playerStates[id].role = 'fake_artist';
        else playerStates[id].role = 'artist';
      });
    }

    return playerStates;
  };

  // 1. ルールを保存して役職割り当てフェーズに進む処理
  const handleSaveRules = async (rules: RuleSettings) => {
    // ここで役職をランダム決定
    const newPlayerStates = generateRoles(rules);

    // 役職に関わらず全員をランダムな順番にする
    const turnOrder = players.map(p => p.userId).sort(() => Math.random() - 0.5);

    await updateGameState({
      ruleSettings: rules,
      playerStates: newPlayerStates,
      turnOrder,
      currentTurnPlayerId: turnOrder[0],
      phase: 'role_assignment' // フェーズを進行させる
    });
  };

  // 2. 役職確認からテーマ設定フェーズへ自動で進む処理
  const proceedToThemeSelection = async () => {
    await updateGameState({ phase: 'theme_selection' });
  };

  // 3. テーマを決定して描画フェーズに進む処理
  const handleThemeSubmit = async (themeGenre: string, theme: string) => {
    await updateGameState({
      themeGenre,
      theme,
      phase: 'drawing'
    });
  };

  // 4. ターン終了時の処理
  const handleTurnEnd = async () => {
    if (!currentGameState || currentGameState.phase !== 'drawing') return;

    const { turnOrder, currentTurnPlayerId, currentLap, ruleSettings } = currentGameState;
    const currentIndex = turnOrder.indexOf(currentTurnPlayerId || '');

    if (currentIndex === -1) return;

    let nextPlayerId: string | null = null;
    let nextLap = currentLap;
    let nextPhase: FakeArtistPhase = currentGameState.phase;

    if (currentIndex + 1 < turnOrder.length) {
      // 次のプレイヤーへ
      nextPlayerId = turnOrder[currentIndex + 1];
    } else {
      // 一周終わった場合、次の周へ
      nextLap = currentLap + 1;
      if (nextLap > ruleSettings.roundLimit) {
        // 設定されたラウンド数を超えたら投票フェーズへ
        nextPhase = 'voting';
        nextPlayerId = null;
      } else {
        nextPlayerId = turnOrder[0];
      }
    }

    await updateGameState({
      currentTurnPlayerId: nextPlayerId,
      currentLap: nextLap,
      phase: nextPhase
    });
  };

  const handleVote = async (votedPlayerId: string) => {
    if (!currentGameState || currentGameState.phase !== 'voting') return;

    await supabase
      .from('game_events')
      .insert({
        room_id: roomId,
        event_type: 'vote',
        payload: { votedPlayerId },
      });

  };

  const handleAllVoted = async () => {
    // 全員の投票が終わったら結果フェーズへ
    await updateGameState({ phase: 'result' });
  };

  return { handleSaveRules, proceedToThemeSelection, handleThemeSubmit, handleTurnEnd, updateGameState, handleVote, handleAllVoted };
}
