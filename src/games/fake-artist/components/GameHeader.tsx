'use client';

interface GameHeaderProps {
  roomId: string;
}

export function GameHeader({ roomId }: GameHeaderProps) {
  return (
    <>
      <h2 className="text-4xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
        エセ芸術家 ニューヨークへ行く
      </h2>
      <p className="text-slate-400 mb-8 text-lg">
        ゲーム画面のひな形です。 (Room: {roomId})
      </p>
    </>
  );
}
