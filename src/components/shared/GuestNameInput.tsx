'use client';

import { useId, useState } from 'react';
import { Avatar } from '@/components/shared/Avatar';
import { AvatarEditor } from '@/components/shared/AvatarEditor';
import { saveGuestDisplayProfile, useGuestAuth } from '@/hooks/useGuestAuth';

export function GuestNameInput() {
  const { profile, loading, error } = useGuestAuth();
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const inputId = useId();
  const name = draftName ?? profile?.name ?? '';

  const avatar = draftAvatar ?? profile?.avatar ?? '';

  const saveProfile = (nextName: string, nextAvatar: string) => {
    if (!profile) return;

    try {
      saveGuestDisplayProfile({ name: nextName.trim(), avatar: nextAvatar });
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  };

  const changeName = (value: string) => {
    setDraftName(value);
    saveProfile(value, avatar);
  };

  const changeAvatar = (value: string) => {
    setDraftAvatar(value);
    saveProfile(name, value);
  };

  return (
    <div className="flex w-full min-w-0 items-start gap-3">
      <div className="shrink-0 pt-5">
        {loading ? (
          <span className="block h-12 w-12 animate-pulse rounded-full bg-[var(--paper-deep)]" />
        ) : profile ? (
          <AvatarEditor value={avatar} name={name} onChange={changeAvatar} />
        ) : (
          <Avatar name={name || 'ゲスト'} size="lg" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <label htmlFor={inputId} className="form-label">あなたの名前</label>
        <input
          id={inputId}
          type="text"
          value={name}
          onChange={(event) => changeName(event.target.value)}
          onBlur={() => setDraftName(name.trim())}
          disabled={loading || !profile}
          placeholder={loading ? '読み込み中…' : '名前を入力'}
          autoComplete="nickname"
          aria-describedby={`${inputId}-help`}
          className="form-input w-full min-w-0"
        />
        <p id={`${inputId}-help`} className="mt-2 text-xs leading-5 text-[var(--muted)]" aria-live="polite">
          {error
            ? 'プレイヤーを読み込めませんでした。ページを再読み込みしてください。'
            : saveError
              ? '変更を保存できませんでした。もう一度お試しください。'
              : '名前とアイコンはこの端末に自動保存され、入室時に使われます。'}
        </p>
      </div>
    </div>
  );
}
