import { createClient } from '@/lib/supabase/client';
import { type FakeArtistGameState, type RuleSettings, type FakeArtistPlayerState, DEFAULT_FAKE_ARTIST_STATE } from '../types';
import type { RoomState } from '@/games/core/types';

export const THEMES = [
  { genre: '動物', themes: ['犬', '猫', 'ライオン', 'ゾウ', 'キリン', 'パンダ', 'コアラ', 'ゴリラ', 'ウサギ', 'サル', 'トラ', 'イルカ', 'ペンギン', 'カンガルー', 'カエル', 'ヘビ', 'ワニ', 'カバ', 'サイ', 'ラクダ'] },
  { genre: '食べ物', themes: ['りんご', 'ハンバーガー', '寿司', 'ラーメン', 'ピザ', 'オムライス', 'カレー', 'たこ焼き', 'ケーキ', 'アイスクリーム', 'ステーキ', 'パスタ', 'サンドイッチ', 'おにぎり', '天ぷら', 'うどん', 'そば', 'パンケーキ', 'クレープ', 'ドーナツ'] },
  { genre: '乗り物', themes: ['車', '飛行機', '新幹線', '自転車', '船', 'バス', 'ヘリコプター', 'トラック', 'バイク', 'タクシー', 'パトカー', '消防車', '救急車', 'ヨット', '気球', 'ロケット', '潜水艦', 'ケーブルカー', 'モノレール', '馬車'] },
  { genre: 'スポーツ', themes: ['野球', 'サッカー', 'テニス', 'バスケットボール', '水泳', '卓球', 'バレーボール', 'バドミントン', 'ゴルフ', 'ラグビー', '柔道', '剣道', 'マラソン', 'フィギュアスケート', 'ボクシング', 'サーフィン', 'スキー', 'スノーボード'] },
  { genre: '場所', themes: ['学校', '病院', '公園', '遊園地', '映画館', '動物園', '水族館', '温泉', 'コンビニ', 'スーパー', 'レストラン', '図書館', '美術館', '駅', '空港', '海', '山', '警察署', '神社', 'お城'] },
  { genre: '職業', themes: ['医者', '警察官', '消防士', '先生', 'YouTuber', '美容師', '大工', 'パイロット', 'シェフ', 'アイドル', '宇宙飛行士', '探偵', 'マジシャン', '忍者', '侍', '裁判官', '農家'] },
  { genre: '日用品', themes: ['時計', 'スマートフォン', 'ハサミ', '歯ブラシ', 'テレビ', '冷蔵庫', '洗濯機', 'パソコン', '傘', '財布', 'ドライヤー', '掃除機', '扇風機', 'エアコン', '電子レンジ', 'タオル'] },
  { genre: '自然', themes: ['太陽', '月', '星', '雲', '雨', '雪', '雷', '虹', '海', '森', '川', '山', '火山', '竜巻', '滝', '砂漠', 'オーロラ', '氷山'] },
  { genre: '身につけるもの', themes: ['帽子', '靴', '靴下', 'メガネ', 'ネクタイ', 'マフラー', '手袋', '腕時計', 'マスク', 'リュック', 'ネックレス', '指輪', 'ピアス', 'ベルト', 'ヘルメット', 'マント'] },
  { genre: '楽器', themes: ['ピアノ', 'ギター', 'バイオリン', 'ドラム', 'トランペット', 'フルート', 'リコーダー', 'カスタネット', 'ハーモニカ', '三味線', '琴', 'サックス', 'トライアングル', 'アコーディオン'] },
  { genre: '文房具', themes: ['鉛筆', '消しゴム', '定規', 'コンパス', 'ノート', 'のり', 'ホッチキス', 'クリップ', '筆箱', '付箋', '万年筆', '筆', '墨', '分度器', '下敷き', 'カッター'] },
  { genre: '家具', themes: ['ベッド', 'ソファ', '机', '椅子', '本棚', 'カーテン', 'ゴミ箱', '鏡', '絨毯', 'こたつ', 'クッション', 'タンス', 'ハンガーラック', '座布団'] }
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
    const baseState = { ...DEFAULT_FAKE_ARTIST_STATE, ...(currentGameState || {}) };
    const updatedState = { ...baseState, ...newStatePartial };

    const { error } = await supabase
      .from('rooms')
      .update({ game_state: updatedState })
      .eq('id', roomId);

    if (error) {
      console.error('ゲーム状態の更新に失敗しました:', error);
      throw new Error(error.message || 'ゲーム状態の更新に失敗しました');
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

    // 出題者を除いて全員をランダムな順番にする (設定で出題者も描く場合は含める)
    const drawingPlayers = players.filter(p => newPlayerStates[p.userId]?.role !== 'questioner' || rules.questionerDraws);
    const turnOrder = drawingPlayers.map(p => p.userId).sort(() => Math.random() - 0.5);

    await updateGameState({
      ruleSettings: rules,
      playerStates: newPlayerStates,
      turnOrder,
      currentTurnPlayerId: turnOrder[0],
      phase: 'role_assignment', // フェーズを進行させる
      currentLap: 1,
      turnRevision: 0,
      themeGenre: null,
      theme: null,
      fakeArtistGuess: null,
      winner: null,
    });
  };

  // 2. 役職確認からテーマ設定フェーズへ自動で進む処理
  const proceedToThemeSelection = async () => {
    const updates: Partial<FakeArtistGameState> = { phase: 'theme_selection' };
    if (currentGameState?.ruleSettings.autoThemeSelection) {
      const picked = getRandomTheme();
      updates.themeGenre = picked.genre;
      updates.theme = picked.theme;
    }
    await updateGameState(updates);
  };

  // 3. テーマを決定して描画フェーズに進む処理
  const handleThemeSubmit = async (themeGenre: string, theme: string) => {
    await updateGameState({
      themeGenre,
      theme,
      phase: 'drawing'
    });
  };

  const handleVote = async (votedPlayerId: string) => {
    if (!currentGameState || currentGameState.phase !== 'voting') {
      throw new Error('現在は投票できません');
    }

    const { data, error } = await supabase.rpc('fake_artist_cast_vote', {
      p_room_id: roomId,
      p_voted_player_id: votedPlayerId,
    });

    if (error || !data) {
      console.error('投票に失敗しました:', error);
      throw new Error(error?.message || '投票に失敗しました');
    }
  };

  const handleAllVoted = async () => {
    const { data, error } = await supabase.rpc('fake_artist_finalize_voting', {
      p_room_id: roomId,
    });

    if (error || !data) {
      console.error('投票結果の確定に失敗しました:', error);
      throw new Error(error?.message || '投票結果の確定に失敗しました');
    }
  };
  const handleFakeArtistGuess = async (guess: string) => {
    await updateGameState({ fakeArtistGuess: guess });
  };

  const handleGuessJudge = async (isCorrect: boolean) => {
    await updateGameState({
      phase: 'result',
      winner: isCorrect ? 'fake_artist' : 'artists'
    });
  };

  const handleResetGame = async () => {
    const { data, error } = await supabase.rpc('fake_artist_reset_game', {
      p_room_id: roomId,
    });

    if (error || !data) {
      console.error('ゲームのリセットに失敗しました:', error);
      throw new Error(error?.message || 'ゲームのリセットに失敗しました');
    }
  };

  const handleUndoStroke = async () => {
    if (!currentGameState || currentGameState.phase !== 'drawing') {
      throw new Error('現在は線をやり直せません');
    }

    // DB側で線の削除とターン巻き戻しを同じトランザクションにする。
    const { data: wasDeleted, error: undoError } = await supabase.rpc('undo_latest_stroke', {
      p_room_id: roomId
    });

    if (undoError || !wasDeleted) {
      console.error('ストロークのやり直しに失敗しました:', undoError);
      throw new Error(undoError?.message || 'やり直せる線がありません');
    }
  };

  return {
    handleSaveRules,
    proceedToThemeSelection,
    handleThemeSubmit,
    updateGameState,
    handleVote,
    handleAllVoted,
    handleFakeArtistGuess,
    handleGuessJudge,
    handleResetGame,
    handleUndoStroke
  };
}
