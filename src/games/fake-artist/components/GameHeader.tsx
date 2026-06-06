'use client';

interface GameHeaderProps {
  roomId: string;
}

export function GameHeader({ roomId }: GameHeaderProps) {
  return (
    <div className="mb-4">
      <h2 className="text-xl sm:text-2xl font-black mb-1 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 leading-tight">
        エセ芸術家 <br className="hidden sm:block" /> ニューヨークへ行く
      </h2>
      <p className="text-slate-400 text-xs">
        Room: <span className="font-mono text-slate-300">{roomId}</span>
      </p>
    </div>
  );
}
