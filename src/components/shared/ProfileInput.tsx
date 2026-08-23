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
            <div className="flex flex-col gap-4 border-y-2 border-[var(--line)] py-5">
                <div className="flex items-center gap-4">
                    {avatarUrl && <Avatar avatarUrl={avatarUrl} name={name || 'プレイヤー'} size="lg" />}
                    <div className="flex-1">
                        <label className="form-label">{label}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => onChangeName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            required
                            className="w-full border-0 border-b-2 border-[var(--line)] bg-transparent pb-2 text-lg font-black text-[var(--ink)] outline-none placeholder:text-[#a39f92] focus:border-[var(--orange)]"
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
                <p className="mb-5 text-center text-sm font-bold text-[var(--muted)]">{label}</p>
            )}
            <input 
                type="text"
                placeholder={placeholder}
                value={name}
                onChange={(e) => onChangeName(e.target.value)}
                onKeyDown={handleKeyDown}
                required
                className="form-input mb-6 text-center text-lg"
            />
            {avatarUrl && onChangeAvatar && (
                <AvatarPicker value={avatarUrl} onChange={onChangeAvatar} />
            )}
        </div>
    );
}
