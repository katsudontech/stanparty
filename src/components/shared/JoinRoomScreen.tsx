'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { saveGuestDisplayProfile, useGuestAuth } from '@/hooks/useGuestAuth';
import { ProfileInput } from '@/components/shared/ProfileInput';
import { SiteHeader } from '@/components/site/SiteHeader';

interface JoinRoomScreenProps {
  roomId: string;
  onJoined: () => Promise<void>;
}

export function JoinRoomScreen({ roomId, onJoined }: JoinRoomScreenProps) {
    const { profile } = useGuestAuth();
    const [joinName, setJoinName] = useState<string | null>(null);
    const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string | null>(null);
    const resolvedJoinName = joinName ?? profile?.name ?? '';
    const resolvedAvatarUrl = selectedAvatarUrl ?? profile?.avatar ?? '';
    const [isJoining, setIsJoining] = useState(false);

    const handleJoin = async () => {
        if (!profile || !resolvedJoinName.trim() || isJoining) return;
        setIsJoining(true);

        const supabase = createClient();
        const updatedProfile = {
            ...profile,
            name: resolvedJoinName.trim(),
            avatar: resolvedAvatarUrl
        };

        saveGuestDisplayProfile({
            name: updatedProfile.name,
            avatar: updatedProfile.avatar
        });

        const { error: profileError } = await supabase
            .from('users')
            .upsert([updatedProfile]);

        if (profileError) {
            console.warn('DBのユーザー登録に失敗しました:', profileError);
            alert('プロフィールの登録に失敗しました');
            setIsJoining(false);
            return;
        }

        const { error: joinError } = await supabase.rpc('join_room', {
            p_room_id: roomId,
            p_name: updatedProfile.name,
            p_avatar_url: updatedProfile.avatar
        });

        if (joinError) {
            console.error('参加に失敗しました:', joinError);
            alert(`参加に失敗しました: ${joinError.message}`);
            setIsJoining(false);
            return;
        }

        await onJoined();
        setIsJoining(false);
    };

    return (
        <div className="site-shell mobile-page">
            <SiteHeader compact />
            <main className="site-container grid min-h-[calc(100dvh-72px)] place-items-center py-8 sm:py-12">
            <div className="paper-card w-full min-w-0 max-w-md p-5 text-center sm:p-9">
                <p className="section-kicker">Invitation</p>
                <h2 className="mb-3 mt-3 text-3xl font-black tracking-[-.05em]">ルームに参加</h2>
                <p className="mb-7 text-sm leading-6 text-[var(--muted)]">表示する名前とアイコンを確認してください。</p>
                
                <div className="mb-6">
                    <ProfileInput
                        name={resolvedJoinName}
                        onChangeName={setJoinName}
                        avatarUrl={resolvedAvatarUrl}
                        onChangeAvatar={setSelectedAvatarUrl}
                        label="参加する名前を入力してください"
                        variant="vertical"
                        onEnter={handleJoin}
                    />
                </div>

                <button 
                    className="button-primary w-full text-lg"
                    onClick={handleJoin}
                    disabled={!profile || !resolvedJoinName.trim() || isJoining}
                >
                    <span className="flex items-center gap-2">
                        {isJoining ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                参加中...
                            </>
                        ) : (
                            '入室する'
                        )}
                    </span>
                </button>
                <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
                    入室すると、<Link href="/terms" className="font-black underline underline-offset-4">利用規約</Link>と<Link href="/privacy" className="font-black underline underline-offset-4">プライバシーポリシー</Link>に同意したものとみなします。
                </p>
            </div>
            </main>
        </div>
    );
}
