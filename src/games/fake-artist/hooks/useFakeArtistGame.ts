import { createClient } from '@/lib/supabase/client';
import { type FakeArtistGameState, type RuleSettings, type FakeArtistPlayerState, type FakeArtistPhase, DEFAULT_FAKE_ARTIST_STATE } from '../types';
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

  const judgeFakeArtistVoted = async () => {
    if (!currentGameState || currentGameState.phase !== 'voting') return;

    //このvote集計処理はいつか関数化するかも
    const { data: votes, error } = await supabase
      .from('game_events')
      .select('*')
      .eq('room_id', roomId)
      .eq('event_type', 'vote');

    if (error) {
      console.error('投票結果の取得に失敗しました:', error);
      return;
    }

    // 1. 各プレイヤーの得票数をカウント
    const voteCounts = (votes || []).reduce((acc, vote) => {
      const targetId = vote.payload.votedPlayerId as string;
      acc[targetId] = (acc[targetId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 2. 最大得票数を計算 (TSの型エラー回避のため明示的にアサーション、もしくは reduce を使用)
    const maxVotes = Object.values(voteCounts).reduce<number>((max, count) => Math.max(max, Number(count)), 0);

    // 3. 最大得票のプレイヤーIDを取得（同票を考慮）
    const mostVotedIds = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);

    console.log('投票結果:', voteCounts);
    console.log('最多得票者:', mostVotedIds);

    // 4. エセ芸術家判定
    // currentGameState.playerStates は { fake_artist: 'user_id_a', ... } の形式
    const fakeArtistId = Object.keys(currentGameState.playerStates).find(
      key => currentGameState.playerStates[key]?.role === 'fake_artist'
    );

    if (!fakeArtistId) {
      console.error('エセ芸術家のIDが見つかりません');
      return;
    }

    // エセ芸術家が最多得票者の中に含まれているか？
    const isFakeArtistVotedOut = mostVotedIds.includes(fakeArtistId);

    console.log('エセ芸術家:', fakeArtistId, '投票結果にエセ芸術家は含まれるか:', isFakeArtistVotedOut);
    return isFakeArtistVotedOut;
  }

  const handleAllVoted = async () => {
    // 全員の投票が終わったら結果を集計して結果フェーズへ
    const isFakeArtistVotedOut = await judgeFakeArtistVoted();

    // TODO: ここで isFakeArtistVotedOut を使ってスコア計算などを行い updateGameState に渡す
    if (isFakeArtistVotedOut) {
      await updateGameState({ phase: 'guessing' });
      return;
    }
    else {

      await updateGameState({ phase: 'result', winner: 'fake_artist' });
      return;
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
    // 1. game_events テーブルの現在のルームのデータをすべて削除する（描画履歴や投票などをクリア）
    const { error: eventError } = await supabase
      .from('game_events')
      .delete()
      .eq('room_id', roomId);

    if (eventError) {
      console.error('イベントデータの削除に失敗しました:', eventError);
    }

    // 2. game_state を初期状態に戻す（ルール設定フェーズへ）
    await updateGameState({
      ...DEFAULT_FAKE_ARTIST_STATE,
      phase: 'rule_setting'
    });
  };

  const handleUndoStroke = async () => {
    if (!currentGameState || currentGameState.phase !== 'drawing') return;

    // DB側でも「現在の手番プレイヤー」だけが最新の線を戻せるようにする。
    const { data: wasDeleted, error: undoError } = await supabase.rpc('undo_latest_stroke', {
      p_room_id: roomId
    });

    if (undoError || !wasDeleted) {
      if (undoError) console.error('ストロークの削除に失敗しました:', undoError);
      return;
    }

    // 3. ターンを一つ前に戻す
    const { turnOrder, currentTurnPlayerId, currentLap } = currentGameState;
    const currentIndex = turnOrder.indexOf(currentTurnPlayerId || '');

    let prevPlayerId: string | null = null;
    let prevLap = currentLap;
    
    if (currentIndex > 0) {
      prevPlayerId = turnOrder[currentIndex - 1];
    } else {
      if (currentLap > 1) {
        prevLap = currentLap - 1;
        prevPlayerId = turnOrder[turnOrder.length - 1];
      } else {
        return; // nothing to undo
      }
    }

    await updateGameState({
      currentTurnPlayerId: prevPlayerId,
      currentLap: prevLap,
    });
  };

  return {
    handleSaveRules,
    proceedToThemeSelection,
    handleThemeSubmit,
    handleTurnEnd,
    updateGameState,
    handleVote,
    handleAllVoted,
    handleFakeArtistGuess,
    handleGuessJudge,
    handleResetGame,
    handleUndoStroke
  };
}
