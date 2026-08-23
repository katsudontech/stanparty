'use client';

import { Avatar } from '@/components/shared/Avatar';
import { AVATAR_TEMPLATES } from '@/lib/avatarTemplates';

interface AvatarPickerProps {
  value: string;
  onChange: (avatarUrl: string) => void;
}

export function AvatarPicker({ value, onChange }: AvatarPickerProps) {
  return (
    <div className="w-full border-t border-white/10 pt-4">
      <p className="mb-3 text-center text-xs font-bold tracking-wider text-slate-400">
        アイコンを選ぶ
      </p>
      <div className="grid grid-cols-4 gap-3" role="group" aria-label="アイコンテンプレート">
        {AVATAR_TEMPLATES.map((template) => {
          const isSelected = template.url === value;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onChange(template.url)}
              aria-pressed={isSelected}
              aria-label={`${template.label}を選択`}
              className={`relative flex min-w-0 flex-col items-center gap-1.5 rounded-xl border p-2 transition focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                isSelected
                  ? 'border-indigo-400 bg-indigo-500/20'
                  : 'border-white/10 bg-black/20 hover:border-white/30 hover:bg-white/5'
              }`}
            >
              <Avatar
                avatarUrl={template.url}
                name={template.label}
                size="lg"
                decorative
                color={isSelected ? '#818cf8' : '#475569'}
              />
              <span className={`truncate text-[10px] font-bold ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                {template.label}
              </span>
              {isSelected && (
                <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-xs text-white">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
