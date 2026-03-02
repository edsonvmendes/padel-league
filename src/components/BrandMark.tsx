'use client';

interface BrandMarkProps {
  withWordmark?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function BrandMark({ withWordmark = false, size = 'md' }: BrandMarkProps) {
  const sizes = {
    sm: { icon: 'w-8 h-8 text-base', text: 'text-sm', tag: 'text-[9px]' },
    md: { icon: 'w-10 h-10 text-lg', text: 'text-base', tag: 'text-[10px]' },
    lg: { icon: 'w-14 h-14 text-2xl', text: 'text-xl', tag: 'text-xs' },
  };
  const s = sizes[size];

  return (
    <div className="flex items-center gap-3">
      <div
        className={`${s.icon} rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0 border border-white/30`}
        style={{
          background: 'linear-gradient(135deg, #0c9b8a 0%, #067a70 68%, #05564f 100%)',
          boxShadow: '0 14px 30px rgba(6,122,112,0.22)',
        }}>
        <span>🎾</span>
      </div>
      {withWordmark && (
        <div>
          <p className={`font-bold text-neutral-900 leading-none tracking-[-0.02em] ${s.text}`}>Padel League</p>
          <p className={`${s.tag} uppercase tracking-[0.22em] text-neutral-500 leading-none mt-1`}>Club Operating System</p>
        </div>
      )}
    </div>
  );
}
