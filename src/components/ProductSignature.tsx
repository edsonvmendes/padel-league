'use client';

export function ProductSignature({ tone = 'default', compact = false }: { tone?: 'default' | 'light'; compact?: boolean }) {
  const isLight = tone === 'light';

  return (
    <div className={`space-y-1 ${compact ? 'text-center' : ''}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${isLight ? 'text-white/42' : 'text-neutral-400'}`}>
        EVPM DEV Solutions
      </p>
      <p className={`text-xs ${isLight ? 'text-white/58' : 'text-neutral-500'}`}>
        edsonvmendes@gmail.com
      </p>
    </div>
  );
}
