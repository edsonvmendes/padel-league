'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { t } from '@/lib/i18n';
import { BrandMark } from '@/components/BrandMark';
import { Home, Users, Calendar, Trophy, Settings, LogOut, Menu, X, Shield } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, profile, loading, locale, setLocale, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leagueId, setLeagueId] = useState<string | null>(null);

  useEffect(() => {
    const match = pathname.match(/\/app\/leagues\/([^/]+)/);
    setLeagueId(match ? match[1] : null);
  }, [pathname]);

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
  ];

  const leagueNav: NavItem[] = leagueId
    ? [
        { label: t('players', locale),  href: `/app/leagues/${leagueId}/players`,  icon: <Users size={20} /> },
        { label: t('rounds', locale),   href: `/app/leagues/${leagueId}/rounds`,   icon: <Calendar size={20} /> },
        { label: t('ranking', locale),  href: `/app/leagues/${leagueId}/ranking`,  icon: <Trophy size={20} /> },
        { label: t('settings', locale), href: `/app/leagues/${leagueId}/settings`, icon: <Settings size={20} /> },
      ]
    : [];

  const adminNav: NavItem[] = profile?.role === 'admin'
    ? [{ label: t('adminRules', locale), href: '/app/admin/rules', icon: <Shield size={20} />, adminOnly: true }]
    : [];

  const allNav = [...mainNav, ...leagueNav, ...adminNav];

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
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-neutral-200">
        {/* Brand */}
        <div className="p-5 border-b border-neutral-200">
          <BrandMark withWordmark />
        </div>

        {/* Nav sections */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {/* Main */}
          {mainNav.map(item => (
            <NavButton key={item.href} item={item} active={isActive(item.href)} onClick={() => handleNav(item.href)} />
          ))}

          {/* League section */}
          {leagueNav.length > 0 && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  {locale === 'es' ? 'Liga' : 'League'}
                </p>
              </div>
              {leagueNav.map(item => (
                <NavButton key={item.href} item={item} active={isActive(item.href)} onClick={() => handleNav(item.href)} />
              ))}
            </>
          )}

          {/* Admin */}
          {adminNav.length > 0 && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Admin</p>
              </div>
              {adminNav.map(item => (
                <NavButton key={item.href} item={item} active={isActive(item.href)} onClick={() => handleNav(item.href)} />
              ))}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 space-y-3">
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
          <div className="text-xs text-neutral-400 text-center truncate">{profile?.full_name}</div>
          <button onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-500 hover:text-red-600 hover:bg-red-50 transition-colors">
            <LogOut size={16} />
            {t('logout', locale)}
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-neutral-200 flex items-center justify-between px-4 z-40">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 -ml-2 text-neutral-600">
          {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className="flex items-center">
          <BrandMark />
        </div>
        <button onClick={() => setLocale(locale === 'en' ? 'es' : locale === 'es' ? 'pt' : 'en')}
          className="px-2 py-1 rounded text-xs font-medium bg-neutral-100 text-neutral-600">
          {locale.toUpperCase()}
        </button>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setSidebarOpen(false)}>
          <div className="w-64 bg-white h-full pt-16 px-3 py-4 space-y-1 overflow-y-auto" onClick={e => e.stopPropagation()}>
            {allNav.map(item => (
              <NavButton key={item.href} item={item} active={isActive(item.href)} onClick={() => handleNav(item.href)} />
            ))}
            <hr className="my-3" />
            <button onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-500 hover:text-red-600">
              <LogOut size={16} />
              {t('logout', locale)}
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="lg:ml-64 pt-14 lg:pt-0 pb-20 lg:pb-6 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-6">
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
        active ? 'bg-teal-50 text-teal-700' : 'text-neutral-600 hover:bg-neutral-100'
      }`}>
      {item.icon}
      {item.label}
    </button>
  );
}
