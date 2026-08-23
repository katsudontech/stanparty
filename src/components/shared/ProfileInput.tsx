import React from 'react';
import { Avatar } from '@/components/shared/Avatar';
import { AvatarPicker } from '@/components/shared/AvatarPicker';

interface ProfileInputProps {
    name: string;
    onChangeName: (name: string) => void;
    avatarUrl?: string;
    onChangeAvatar?: (avatarUrl: string) => void;
    label?: string;
    placeholder?: string;
    variant?: 'horizontal' | 'vertical';
    onEnter?: () => void;
}

export function ProfileInput({
    name,
    onChangeName,
    avatarUrl,
    onChangeAvatar,
    label = "あなたの名前",
    placeholder = "名前を入力",
    variant = 'horizontal',
    onEnter
}: ProfileInputProps) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && onEnter) {
            e.preventDefault();
            onEnter();
        }
    };

    if (variant === 'horizontal') {
        return (
            <div className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-black/40 p-4 shadow-inner">
                <div className="flex items-center gap-4">
                    {avatarUrl && <Avatar avatarUrl={avatarUrl} name={name || 'プレイヤー'} size="lg" />}
                    <div className="flex-1">
                        <label className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">{label}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => onChangeName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            required
                            className="w-full bg-transparent border-b border-white/20 pb-1 focus:outline-none focus:border-indigo-500 text-white font-bold text-lg transition-colors placeholder-slate-600"
                        />
                    </div>
                </div>
                {avatarUrl && onChangeAvatar && (
                    <AvatarPicker value={avatarUrl} onChange={onChangeAvatar} />
                )}
            </div>
        );
    }

    // Vertical variant
    return (
        <div className="flex flex-col items-center w-full">
            {avatarUrl && (
                <div className="mb-6 flex justify-center">
                    <Avatar avatarUrl={avatarUrl} name={name || 'プレイヤー'} size="xl" />
                </div>
            )}
            {label && (
                <p className="text-sm text-slate-400 mb-6 font-medium text-center">{label}</p>
            )}
            <input 
                type="text"
                placeholder={placeholder}
                value={name}
                onChange={(e) => onChangeName(e.target.value)}
                onKeyDown={handleKeyDown}
                required
                className="w-full bg-black/40 border border-white/10 p-4 rounded-xl mb-6 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-white text-center text-lg font-bold transition-all shadow-inner"
            />
            {avatarUrl && onChangeAvatar && (
                <AvatarPicker value={avatarUrl} onChange={onChangeAvatar} />
            )}
        </div>
    );
}
