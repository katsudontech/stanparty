'use client';

import Link from 'next/link';
import { useGuestAuth } from '@/hooks/useGuestAuth';
import { Avatar } from '@/components/shared/Avatar';

export default function Home() {
  const { profile, loading } = useGuestAuth();

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-slate-950 font-sans selection:bg-indigo-500/30">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/30 blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-fuchsia-600/20 blur-[120px] animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      <main className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl w-full">
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          <span className="text-xs font-semibold tracking-wider text-slate-300 uppercase">StanParty is Live</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-indigo-200 to-fuchsia-400 mb-6 tracking-tight drop-shadow-sm pb-2">
          待ち時間も<br className="md:hidden" />パーティに変えよう
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 mb-12 max-w-2xl leading-relaxed font-medium">
          テーマパークの長い待ち時間。スマホひとつで友達と一緒にサクッと遊べる、リアルタイムのマルチプレイパーティゲーム。
        </p>

        <div className="flex flex-col sm:flex-row gap-5 w-full justify-center">
          <Link
            href="/create_room"
            className="group relative flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-lg transition-all duration-300 shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] hover:shadow-[0_0_60px_-15px_rgba(79,70,229,0.7)] hover:-translate-y-1"
          >
            <span>部屋を作成する</span>
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </Link>
          
          <Link
            href="/join_room"
            className="group relative flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-bold text-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-1"
          >
            <span>部屋に参加する</span>
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </Link>
        </div>

        {/* Profile Card */}
        <div className="mt-24 flex flex-col items-center opacity-0 animate-[fadeIn_1s_ease-out_0.5s_forwards]">
          <p className="text-xs text-slate-500 mb-4 font-bold tracking-widest uppercase">現在のプレイヤー</p>
          <div className="flex items-center gap-4 px-6 py-3 bg-white/5 border border-white/10 rounded-full backdrop-blur-md shadow-xl transition-transform hover:scale-105">
            {loading ? (
              <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
            ) : (
              <Avatar avatarUrl={profile?.avatar} name={profile?.name ?? 'ゲスト'} size="md" />
            )}
            <div className="text-left pr-2">
              <div className="text-sm font-bold text-white">{loading ? '読み込み中...' : profile?.name}</div>
              <div className="text-xs text-indigo-400 font-semibold">Guest Profile</div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
