'use client';

import { ReactNode } from 'react';

interface GameWrapperProps {
  children: ReactNode;
}

export function GameWrapper({ children }: GameWrapperProps) {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 font-sans">
      <div className="w-full max-w-screen-2xl mx-auto">
        <header className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold">
              SP
            </div>
            <h1 className="text-xl font-bold tracking-wider">STANPARTY</h1>
          </div>
          
          <button 
            className="text-sm font-medium bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors border border-slate-700"
            onClick={() => alert('TODO: 退室処理')}
          >
            退出する
          </button>
        </header>
        
        <main className="animate-in fade-in duration-500">
          {children}
        </main>
      </div>
    </div>
  );
}
