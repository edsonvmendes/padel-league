'use client';

import Image from 'next/image';

interface BrandMarkProps {
  withWordmark?: boolean;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'light';
}

export function BrandMark({ withWordmark = false, size = 'md', tone = 'default' }: BrandMarkProps) {
  const sizes = {
    sm: { wrap: 'gap-2.5', icon: 'h-8 w-8', text: 'text-sm', tag: 'text-[9px]' },
    md: { wrap: 'gap-3', icon: 'h-10 w-10', text: 'text-base', tag: 'text-[10px]' },
    lg: { wrap: 'gap-3.5', icon: 'h-14 w-14', text: 'text-xl', tag: 'text-xs' },
  };
  const s = sizes[size];
  const isLight = tone === 'light';

  return (
    <div className={`flex items-center ${withWordmark ? s.wrap : ''}`}>
      <div
        className={`${s.icon} relative flex-shrink-0 overflow-hidden rounded-[1.2rem] ring-1 ring-black/5`}
        style={{
          background: 'radial-gradient(circle at 50% 40%, rgba(163, 230, 53, 0.12), rgba(12, 32, 38, 0.02) 72%, transparent 100%)',
        }}>
        <Image
          src="/logo.png"
          alt="Padel League"
          fill
          sizes="56px"
          priority={size === 'lg'}
          className="scale-[1.22] object-cover"
        />
      </div>
      {withWordmark && (
        <div>
          <p className={`font-bold leading-none tracking-[-0.03em] ${isLight ? 'text-white' : 'text-neutral-900'} ${s.text}`}>Padel League</p>
          <p className={`${s.tag} mt-1 leading-none uppercase tracking-[0.18em] ${isLight ? 'text-white/65' : 'text-neutral-500'}`}>Club Edition</p>
        </div>
      )}
    </div>
  );
}
