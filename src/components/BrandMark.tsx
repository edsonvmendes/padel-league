'use client';

interface BrandMarkProps {
  withWordmark?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function BrandMark({ withWordmark = false, size = 'md' }: BrandMarkProps) {
  const sizes = {
    sm: { icon: 'w-7 h-7 text-base', text: 'text-sm' },
    md: { icon: 'w-9 h-9 text-lg',  text: 'text-base' },
    lg: { icon: 'w-12 h-12 text-2xl', text: 'text-xl' },
  };
  const s = sizes[size];

  return (
    <div className="flex items-center gap-2.5">
      <div className={`${s.icon} bg-teal-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0`}>
        <span>🎾</span>
      </div>
      {withWordmark && (
        <div>
          <p className={`font-bold text-neutral-900 leading-none ${s.text}`}>Padel League</p>
          <p className="text-[10px] text-neutral-400 leading-none mt-0.5">Management</p>
        </div>
      )}
    </div>
  );
}
