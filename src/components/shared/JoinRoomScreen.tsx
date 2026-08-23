'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { saveGuestDisplayProfile, useGuestAuth } from '@/hooks/useGuestAuth';
import { ProfileInput } from '@/components/shared/ProfileInput';

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
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 selection:bg-indigo-500/30">
            <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-[30%] h-[30%] rounded-full bg-indigo-600/20 blur-[100px] animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-1/4 right-1/4 w-[30%] h-[30%] rounded-full bg-fuchsia-600/20 blur-[100px] animate-pulse" style={{ animationDuration: '6s' }} />
            </div>

            <div className="bg-slate-900/50 border border-white/10 p-8 rounded-3xl backdrop-blur-xl shadow-2xl w-full max-w-sm text-center relative z-10">
                <h2 className="text-2xl font-black mb-6 text-white tracking-tight">ルームに参加</h2>
                
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
                    className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-lg font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all overflow-hidden shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)]"
                    onClick={handleJoin}
                    disabled={!profile || !resolvedJoinName.trim() || isJoining}
                >
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                    <span className="relative flex items-center gap-2">
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
            </div>
        </div>
    );
}
