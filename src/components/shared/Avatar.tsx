import Image from 'next/image';

interface AvatarProps {
  avatarUrl?: string | null;
  name: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  decorative?: boolean;
  className?: string;
}

const AVATAR_SIZES = {
  xs: { pixels: 24, className: 'h-6 w-6 text-[10px]' },
  sm: { pixels: 32, className: 'h-8 w-8 text-xs' },
  md: { pixels: 40, className: 'h-10 w-10 text-sm' },
  lg: { pixels: 48, className: 'h-12 w-12 text-base' },
  xl: { pixels: 80, className: 'h-20 w-20 text-2xl' },
} as const;

export function Avatar({
  avatarUrl,
  name,
  color = '#475569',
  size = 'md',
  decorative = false,
  className = '',
}: AvatarProps) {
  const avatarSize = AVATAR_SIZES[size];
  const label = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white font-black text-white ${avatarSize.className} ${className}`}
      style={{ boxShadow: `0 0 0 2px ${color}` }}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={decorative ? '' : `${name}のアイコン`}
          width={avatarSize.pixels}
          height={avatarSize.pixels}
          unoptimized
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          aria-label={decorative ? undefined : `${name}のアイコン`}
          aria-hidden={decorative || undefined}
          className="flex h-full w-full items-center justify-center"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
