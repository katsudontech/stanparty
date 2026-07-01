import React from 'react';

interface ProfileInputProps {
    name: string;
    onChangeName: (name: string) => void;
    avatarUrl?: string;
    label?: string;
    placeholder?: string;
    variant?: 'horizontal' | 'vertical';
    onEnter?: () => void;
}

export function ProfileInput({
    name,
    onChangeName,
    avatarUrl,
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
            <div className="flex items-center gap-4 p-4 bg-black/40 rounded-2xl border border-white/5 shadow-inner">
                {avatarUrl && (
                    <img src={avatarUrl} alt="Avatar" className="w-12 h-12 rounded-full bg-white ring-2 ring-indigo-500/50 shrink-0" />
                )}
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
        );
    }

    // Vertical variant
    return (
        <div className="flex flex-col items-center w-full">
            {avatarUrl && (
                <div className="mb-6 flex justify-center">
                    <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full bg-white ring-4 ring-indigo-500/50 shadow-lg" />
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
        </div>
    );
}
