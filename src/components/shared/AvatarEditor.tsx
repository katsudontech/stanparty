'use client';

import { useId, useRef } from 'react';
import { Avatar } from '@/components/shared/Avatar';
import { AvatarPicker } from '@/components/shared/AvatarPicker';

interface AvatarEditorProps {
  value: string;
  name: string;
  onChange: (avatarUrl: string) => void;
  size?: 'lg' | 'xl';
}

export function AvatarEditor({ value, name, onChange, size = 'lg' }: AvatarEditorProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        aria-label="自分のアイコンを変更"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
        className="group flex shrink-0 cursor-pointer flex-col items-center gap-2 rounded-xl p-1 text-[var(--ink)] transition hover:bg-[var(--paper-deep)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--orange)]"
      >
        <span className="relative inline-flex">
          <Avatar avatarUrl={value} name={name || 'プレイヤー'} size={size} decorative />
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--orange)] text-white" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" />
              <path d="m13 6 5 5" />
            </svg>
          </span>
        </span>
        <span className="text-[.65rem] font-bold group-hover:underline">変更する</span>
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border-2 border-[var(--line)] bg-[var(--surface)] p-0 text-[var(--ink)] shadow-xl backdrop:bg-black/40"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="p-4 sm:p-5">
          <header className="mb-4 flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-lg font-black">アイコンを変更</h2>
            <button type="button" onClick={() => dialogRef.current?.close()} aria-label="アイコン選択を閉じる" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--line)] text-2xl hover:bg-[var(--paper-deep)]">×</button>
          </header>
          <AvatarPicker value={value} onChange={(avatarUrl) => {
            onChange(avatarUrl);
            dialogRef.current?.close();
          }} />
        </div>
      </dialog>
    </>
  );
}
