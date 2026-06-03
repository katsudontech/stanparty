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
    handleResetGame
  };
}
