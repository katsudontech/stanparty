import { useEffect } from 'react';
import type { FakeArtistPlayerState } from '../types';

interface RoleAssignmentPhaseProps {
  playerStates: Record<string, FakeArtistPlayerState>;
  myUserId: string | null;
  isHost: boolean;
  onTimeout: () => void;
  turnOrder: string[];
}

export function RoleAssignmentPhase({ playerStates, myUserId, isHost, onTimeout, turnOrder }: RoleAssignmentPhaseProps) {

  // myUserIdをキーにして、playerStatesから自分の役職を取り出す
  const myState = myUserId ? playerStates[myUserId] : null;
  const myRole = myState?.role;
  const myTurnIndex = myUserId ? turnOrder.indexOf(myUserId) : -1;

  // 5秒後に自動遷移する処理
  useEffect(() => {
    // 重複してDB更新が走らないよう、ホストだけがタイマーを動かして次へ進める権限を持つ
    if (!isHost) return;
    
    const timer = setTimeout(() => {
      onTimeout();
    }, 5000);

    return () => clearTimeout(timer);
  }, [isHost, onTimeout]);

  return (
    <div className="text-white mt-8 bg-slate-700/50 p-8 rounded-xl border border-slate-600">
      <h3 className="text-2xl font-bold mb-4">役職確認</h3>
      <p className="text-slate-400 mb-6">自分が「エセ芸術家」か「本物の芸術家」かを確認する画面です。</p>
      
      <div className="bg-slate-800 p-6 rounded-lg mb-8 border border-slate-600">
        {myRole === 'questioner' && (
          <div>
            <p className="text-3xl font-bold text-yellow-400 mb-2">あなたは「出題者」です</p>
            <p className="text-sm text-slate-300">お題を決める役割です。</p>
            {myTurnIndex !== -1 && (
              <div className="mt-4 inline-block bg-slate-700/80 px-4 py-2 rounded-full border border-slate-600">
                <span className="text-sm text-slate-300 mr-2">描く順番:</span>
                <span className="text-xl font-bold text-white">{myTurnIndex + 1}番目</span>
              </div>
            )}
          </div>
        )}
        {myRole === 'fake_artist' && (
          <div>
            <p className="text-3xl font-bold text-red-400 mb-2">あなたは「エセ芸術家」です</p>
            <p className="text-sm text-slate-300">お題を知りません。他の人の絵を見てバレないように描いてください。</p>
            {myTurnIndex !== -1 && (
              <div className="mt-4 inline-block bg-slate-700/80 px-4 py-2 rounded-full border border-slate-600">
                <span className="text-sm text-slate-300 mr-2">描く順番:</span>
                <span className="text-xl font-bold text-white">{myTurnIndex + 1}番目</span>
              </div>
            )}
          </div>
        )}
        {myRole === 'artist' && (
          <div>
            <p className="text-3xl font-bold text-blue-400 mb-2">あなたは「本物の芸術家」です</p>
            <p className="text-sm text-slate-300">お題に沿った絵を描いてください。</p>
            {myTurnIndex !== -1 && (
              <div className="mt-4 inline-block bg-slate-700/80 px-4 py-2 rounded-full border border-slate-600">
                <span className="text-sm text-slate-300 mr-2">描く順番:</span>
                <span className="text-xl font-bold text-white">{myTurnIndex + 1}番目</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
        <svg className="animate-spin h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p>5秒後に自動的にお題設定へ進みます...</p>
      </div>
    </div>
  );
}
