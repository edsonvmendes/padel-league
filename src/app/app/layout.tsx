'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useDb } from '@/hooks/useDb';
import { t } from '@/lib/i18n';
import { BrandMark } from '@/components/BrandMark';
import { ProductSignature } from '@/components/ProductSignature';
import { League } from '@/types/database';
import { Home, Users, Calendar, Settings, LogOut, Menu, X, Trophy, BookOpen } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, profile, loading, locale, setLocale, signOut } = useAuth();
  const { db, run } = useDb();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [activeLeague, setActiveLeague] = useState<League | null>(null);
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || '';

  useEffect(() => {
    const match = pathname.match(/\/app\/leagues\/([^/]+)/);
    setLeagueId(match ? match[1] : null);
  }, [pathname]);

  useEffect(() => {
    let active = true;

    const loadActiveLeague = async () => {
      if (!leagueId || !user) {
        setActiveLeague(null);
        return;
      }

      const { data } = await run(() => db.from('leagues').select('*').eq('id', leagueId).single());
      if (active) setActiveLeague((data as League) || null);
    };

    loadActiveLeague();
    return () => {
      active = false;
    };
  }, [db, leagueId, run, user]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, profile, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-teal-600 text-lg">{t('loading', locale)}</div>
      </div>
    );
  }

  const mainNav: NavItem[] = [
    { label: t('dashboard', locale), href: '/app', icon: <Home size={20} /> },
    { label: t('leagues', locale), href: '/app/leagues', icon: <Calendar size={20} /> },
    { label: t('manual', locale), href: '/app/manual', icon: <BookOpen size={20} /> },
  ];

  const leagueNav: NavItem[] = leagueId
    ? [
        { label: t('players', locale),  href: `/app/leagues/${leagueId}/players`,  icon: <Users size={20} /> },
        { label: t('rounds', locale),   href: `/app/leagues/${leagueId}/rounds`,   icon: <Calendar size={20} /> },
        { label: t('ranking', locale),  href: `/app/leagues/${leagueId}/ranking`,  icon: <Trophy size={20} /> },
        { label: t('settings', locale), href: `/app/leagues/${leagueId}/settings`, icon: <Settings size={20} /> },
      ]
    : [];
  const allNav = [...mainNav, ...leagueNav];

  const isActive = (href: string) => {
    if (href === '/app') return pathname === '/app';
    return pathname.startsWith(href);
  };

  const handleNav = (href: string) => {
    router.push(href);
    setSidebarOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  // Bottom nav (mobile) — máximo 5 itens
  const bottomNavItems = leagueId
    ? [
        { label: t('dashboard', locale), href: '/app',                                  icon: <Home size={18} /> },
        { label: t('players', locale),   href: `/app/leagues/${leagueId}/players`,      icon: <Users size={18} /> },
        { label: t('rounds', locale),    href: `/app/leagues/${leagueId}/rounds`,       icon: <Calendar size={18} /> },
        { label: t('ranking', locale),   href: `/app/leagues/${leagueId}/ranking`,      icon: <Trophy size={18} /> },
        { label: t('settings', locale),  href: `/app/leagues/${leagueId}/settings`,     icon: <Settings size={18} /> },
      ]
    : [
        { label: t('dashboard', locale), href: '/app',         icon: <Home size={18} /> },
        { label: t('leagues', locale),   href: '/app/leagues', icon: <Calendar size={18} /> },
      ];

  return (
    <div className="min-h-screen app-bg">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:inset-y-4 lg:left-4 rounded-[2rem] border border-white/40 bg-white/75 backdrop-blur-xl shadow-[0_24px_60px_rgba(8,20,26,0.10)]">
        {/* Brand */}
        <div className="p-6 border-b border-black/5">
          <BrandMark withWordmark />
          <div className="mt-4 rounded-2xl border border-white/60 bg-white/65 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
              {locale === 'pt' ? 'Sessão ativa' : locale === 'es' ? 'Sesión actual' : 'Active session'}
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-700">
              {firstName
                ? (locale === 'pt' ? `Olá, ${firstName}` : locale === 'es' ? `Hola, ${firstName}` : `Hi, ${firstName}`)
                : (locale === 'pt' ? 'Olá' : locale === 'es' ? 'Hola' : 'Hi')}
            </p>
          </div>
        </div>

        {/* Nav sections */}
        <nav className="flex-1 py-5 px-4 space-y-1 overflow-y-auto">
          {/* Main */}
          {mainNav.map(item => (
            <NavButton key={item.href} item={item} active={isActive(item.href)} onClick={() => handleNav(item.href)} />
          ))}

          {/* League section */}
          {leagueNav.length > 0 && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  {locale === 'pt' ? 'Liga atual' : locale === 'es' ? 'Liga actual' : 'Current league'}
                </p>
              </div>
              <div className="mx-1 mb-2 rounded-2xl border border-teal-500/10 bg-teal-50/80 px-3 py-3">
                <p className="truncate text-sm font-bold text-neutral-900">
                  {activeLeague?.name || (locale === 'pt' ? 'Carregando liga...' : locale === 'es' ? 'Cargando liga...' : 'Loading league...')}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700 ring-1 ring-teal-500/10">
                    {activeLeague?.is_finished
                      ? (locale === 'pt' ? 'finalizada' : locale === 'es' ? 'finalizada' : 'finished')
                      : (locale === 'pt' ? 'em operação' : locale === 'es' ? 'en operación' : 'active')}
                  </span>
                  <button
                    onClick={() => handleNav('/app/leagues')}
                    className="text-[11px] font-semibold text-neutral-500 transition hover:text-teal-700"
                  >
                    {locale === 'pt' ? 'Trocar' : locale === 'es' ? 'Cambiar' : 'Switch'}
                  </button>
                </div>
              </div>
              {leagueNav.map(item => (
                <NavButton key={item.href} item={item} active={isActive(item.href)} onClick={() => handleNav(item.href)} />
              ))}
            </>
          )}

        </nav>

        {/* Footer */}
        <div className="p-5 border-t border-black/5 space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setLocale('en')}
              className={`flex-1 px-2 py-1 rounded text-xs font-medium ${locale === 'en' ? 'bg-teal-600 text-white' : 'bg-neutral-100 text-neutral-500'}`}>
              EN
            </button>
            <button onClick={() => setLocale('es')}
              className={`flex-1 px-2 py-1 rounded text-xs font-medium ${locale === 'es' ? 'bg-teal-600 text-white' : 'bg-neutral-100 text-neutral-500'}`}>
              ES
            </button>
            <button onClick={() => setLocale('pt')}
              className={`flex-1 px-2 py-1 rounded text-xs font-medium ${locale === 'pt' ? 'bg-teal-600 text-white' : 'bg-neutral-100 text-neutral-500'}`}>
              PT
            </button>
          </div>
          <div className="rounded-2xl border border-black/5 bg-white/55 px-3 py-2.5">
            <ProductSignature compact />
          </div>
          <div className="text-xs text-neutral-400 text-center truncate">{profile?.full_name || user.email}</div>
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-500 hover:text-red-600 hover:bg-red-50 transition-colors">
            <LogOut size={16} />
            {t('logout', locale)}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 border-b border-black/5 bg-[rgba(255,251,244,0.86)] backdrop-blur-xl flex items-center justify-between px-4 z-40">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? (locale === 'pt' ? 'Fechar menu' : locale === 'es' ? 'Cerrar menu' : 'Close menu') : (locale === 'pt' ? 'Abrir menu' : locale === 'es' ? 'Abrir menu' : 'Open menu')}
          className="p-2 -ml-2 text-neutral-600"
        >
          {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className="flex items-center">
          <BrandMark />
        </div>
        <button
          onClick={() => setLocale(locale === 'en' ? 'es' : locale === 'es' ? 'pt' : 'en')}
          aria-label={locale === 'pt' ? 'Trocar idioma' : locale === 'es' ? 'Cambiar idioma' : 'Change language'}
          className="px-2 py-1 rounded text-xs font-medium bg-neutral-100 text-neutral-600">
          {locale.toUpperCase()}
        </button>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setSidebarOpen(false)}>
          <div className="w-64 bg-white h-full pt-16 px-3 py-4 space-y-1 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="mb-3 rounded-2xl border border-black/5 bg-neutral-50 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                {locale === 'pt' ? 'Sessão ativa' : locale === 'es' ? 'Sesión actual' : 'Active session'}
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-700">
                {firstName
                  ? (locale === 'pt' ? `Olá, ${firstName}` : locale === 'es' ? `Hola, ${firstName}` : `Hi, ${firstName}`)
                  : (locale === 'pt' ? 'Olá' : locale === 'es' ? 'Hola' : 'Hi')}
              </p>
            </div>
            {allNav.map(item => (
              <NavButton key={item.href} item={item} active={isActive(item.href)} onClick={() => handleNav(item.href)} />
            ))}
            {leagueId && (
              <div className="my-3 rounded-2xl border border-teal-500/10 bg-teal-50 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-700">
                  {locale === 'pt' ? 'Liga atual' : locale === 'es' ? 'Liga actual' : 'Current league'}
                </p>
                <p className="mt-1 truncate text-sm font-bold text-neutral-800">{activeLeague?.name || '-'}</p>
                <button
                  onClick={() => handleNav('/app/leagues')}
                  className="mt-2 text-xs font-semibold text-teal-700"
                >
                  {locale === 'pt' ? 'Trocar liga' : locale === 'es' ? 'Cambiar liga' : 'Switch league'}
                </button>
              </div>
            )}
            <hr className="my-3" />
            <div className="rounded-2xl border border-black/5 bg-neutral-50 px-3 py-2.5">
              <ProductSignature compact />
            </div>
            <button onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-500 hover:text-red-600">
              <LogOut size={16} />
              {t('logout', locale)}
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="lg:ml-[19rem] xl:ml-[21rem] pt-14 lg:pt-0 pb-20 lg:pb-8 min-h-screen">
        <div className="w-full max-w-[88rem] px-4 py-6 lg:px-6">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav lg:hidden">
        {bottomNavItems.map(item => (
          <button key={item.href} onClick={() => handleNav(item.href)}
            className={`bottom-nav-item ${isActive(item.href) ? 'active' : ''}`}>
            {item.icon}
            <span className="mt-0.5">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-white text-teal-800 shadow-[0_10px_24px_rgba(6,122,112,0.08)]' : 'text-neutral-600 hover:bg-white/70'
      }`}>
      {item.icon}
      {item.label}
    </button>
  );
}
