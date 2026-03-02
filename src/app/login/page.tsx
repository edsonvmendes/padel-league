'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { BrandMark } from '@/components/BrandMark';
import { ProductSignature } from '@/components/ProductSignature';

const LOGIN_BG_VIDEO = '/login-bg.mp4';
const LOCALE_KEY = 'padel_locale';

type LoginLocale = 'en' | 'es' | 'pt';

const COPY: Record<LoginLocale, Record<string, string>> = {
  es: {
    badge: 'Acceso seguro',
    welcome: 'Bienvenida de nuevo',
    title: 'Entrar en tu central',
    description: 'Accede a tu operación semanal, actualiza jornadas y mantén la liga organizada sin perder contexto.',
    email: 'Email',
    emailPlaceholder: 'tu@dominio.com',
    password: 'Clave',
    passwordPlaceholder: '••••••••',
    submit: 'Entrar ahora',
    submitting: 'Entrando...',
    heroEyebrow: 'Padel Operations',
    heroTitle: 'Gestion de liga con presencia de producto premium.',
    heroText: 'Centraliza jornadas, jugadoras, configuraciones y operación semanal en una experiencia limpia, rápida y con apariencia de software serio.',
    stat1: 'Jornadas por temporada',
    stat2: 'Menos retrabajo manual',
    stat3: 'Base operativa única',
    card1Title: 'Flujo simple',
    card1Text: 'Jornadas, presencia y marcadores en el mismo eje operativo.',
    card2Title: 'Control real',
    card2Text: 'Menos improvisacion en cancha y menos ruido administrativo.',
  },
  pt: {
    badge: 'Acesso seguro',
    welcome: 'Bem-vinda de volta',
    title: 'Entrar na sua central',
    description: 'Acesse sua operação semanal, atualize rodadas e mantenha a liga organizada sem perder contexto.',
    email: 'Email',
    emailPlaceholder: 'voce@seudominio.com',
    password: 'Senha',
    passwordPlaceholder: '••••••••',
    submit: 'Entrar agora',
    submitting: 'Entrando...',
    heroEyebrow: 'Padel Operations',
    heroTitle: 'Gestão de liga com presença de produto premium.',
    heroText: 'Centralize rodadas, jogadoras, configurações e operação semanal em uma experiência limpa, rápida e com aparência de software sério.',
    stat1: 'Rodadas por temporada',
    stat2: 'Menos retrabalho manual',
    stat3: 'Base operacional única',
    card1Title: 'Fluxo enxuto',
    card1Text: 'Rodadas, presença e placares no mesmo eixo operacional.',
    card2Title: 'Controle real',
    card2Text: 'Menos improviso na quadra e menos ruido administrativo.',
  },
  en: {
    badge: 'Secure access',
    welcome: 'Welcome back',
    title: 'Sign in to your hub',
    description: 'Access your weekly operation, update rounds, and keep the league organized without losing context.',
    email: 'Email',
    emailPlaceholder: 'you@yourdomain.com',
    password: 'Password',
    passwordPlaceholder: '••••••••',
    submit: 'Sign in now',
    submitting: 'Signing in...',
    heroEyebrow: 'Padel Operations',
    heroTitle: 'League management with premium product presence.',
    heroText: 'Centralize rounds, players, settings and weekly operations in a clean, fast experience with the feel of serious software.',
    stat1: 'Rounds per season',
    stat2: 'Less manual rework',
    stat3: 'Single operating base',
    card1Title: 'Lean flow',
    card1Text: 'Rounds, attendance and scores in the same operating axis.',
    card2Title: 'Real control',
    card2Text: 'Less on-court improvisation and less admin noise.',
  },
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locale, setLocale] = useState<LoginLocale>('es');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const saved = localStorage.getItem(LOCALE_KEY) as LoginLocale | null;
    if (saved === 'en' || saved === 'es' || saved === 'pt') {
      setLocale(saved);
      return;
    }

    const browser = navigator.language.toLowerCase();
    if (browser.startsWith('pt')) {
      setLocale('pt');
      return;
    }

    if (browser.startsWith('en')) {
      setLocale('en');
      return;
    }

    setLocale('es');
  }, []);

  const copy = COPY[locale];

  const normalizeAuthError = (message: string) => {
    const raw = message.toLowerCase();

    if (raw.includes('invalid login credentials')) {
      return locale === 'pt'
        ? 'Credenciais inválidas.'
        : locale === 'es'
          ? 'Credenciales inválidas.'
          : 'Invalid email or password.';
    }

    if (raw.includes('email not confirmed')) {
      return locale === 'pt'
        ? 'Confirme seu email antes de entrar.'
        : locale === 'es'
          ? 'Confirma tu email antes de entrar.'
          : 'Confirm your email before signing in.';
    }

    return locale === 'pt'
      ? 'Não foi possível entrar agora. Tente novamente.'
      : locale === 'es'
        ? 'No fue posible entrar ahora. Intenta de nuevo.'
        : 'Unable to sign in right now. Please try again.';
  };

  const cycleLocale = () => {
    const next: LoginLocale = locale === 'es' ? 'pt' : locale === 'pt' ? 'en' : 'es';
    setLocale(next);
    if (typeof window !== 'undefined') localStorage.setItem(LOCALE_KEY, next);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(normalizeAuthError(error.message));
      setLoading(false);
    } else {
      router.push('/app');
      router.refresh();
    }
  };

  return (
    <div className="relative isolate min-h-screen overflow-hidden px-3 py-4 sm:px-6 sm:py-6 lg:px-10">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <video
          className="h-full w-full scale-[1.08] object-cover object-[36%_center] opacity-[0.2] grayscale contrast-75 saturate-0"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          <source src={LOGIN_BG_VIDEO} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_42%,_rgba(20,24,28,0.08)_70%,_rgba(20,24,28,0.18)_100%)]" />
        <div className="absolute inset-y-0 left-0 w-[14vw] bg-gradient-to-r from-[rgba(28,34,38,0.3)] via-[rgba(28,34,38,0.14)] to-transparent" />
        <div className="absolute inset-y-0 right-0 w-[16vw] bg-gradient-to-l from-[rgba(28,34,38,0.34)] via-[rgba(28,34,38,0.16)] to-transparent" />
      </div>
      <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_top_left,_rgba(214,214,214,0.08),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(255,255,255,0.08),_transparent_28%),linear-gradient(135deg,_rgba(34,40,44,0.68)_0%,_rgba(56,63,68,0.6)_52%,_rgba(72,80,86,0.66)_100%)]" />
      <div className="absolute inset-y-0 right-0 z-10 hidden lg:block w-[44vw] bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.16),_transparent_46%)]" />

      <div className="relative z-20 mx-auto flex min-h-[calc(100vh-2rem)] sm:min-h-[calc(100vh-3rem)] max-w-7xl items-center">
        <div className="grid w-full gap-5 sm:gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="hidden lg:flex flex-col justify-between rounded-[2rem] border border-white/10 bg-[linear-gradient(165deg,rgba(6,19,25,0.78),rgba(10,29,36,0.62))] p-10 text-white backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="space-y-8">
              <BrandMark withWordmark size="lg" tone="light" />
              <div className="space-y-5">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/80">{copy.heroEyebrow}</p>
                <h1 className="max-w-xl text-5xl font-black leading-[0.96] tracking-[-0.04em] text-white/90">{copy.heroTitle}</h1>
                <p className="max-w-lg text-base leading-7 text-white/64">{copy.heroText}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-3xl font-black text-white/88">12</p>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/48">{copy.stat1}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-3xl font-black text-white/88">4x</p>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/48">{copy.stat2}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-3xl font-black text-white/88">1</p>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/48">{copy.stat3}</p>
              </div>
            </div>
          </section>

          <section className="surface-card mx-auto flex w-full max-w-xl flex-col justify-center p-5 sm:p-8 lg:p-10">
            <div className="mb-7 flex flex-col items-start gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
              <BrandMark withWordmark size="sm" />
              <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
                <button
                  type="button"
                  onClick={cycleLocale}
                  className="rounded-full border border-black/5 bg-white/78 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500"
                >
                  {locale.toUpperCase()}
                </button>
                <div className="rounded-full border border-black/5 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  {copy.badge}
                </div>
              </div>
            </div>

            <div className="mb-7 sm:mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">{copy.welcome}</p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] text-neutral-900 sm:text-3xl">{copy.title}</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-500">{copy.description}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="label-field">{copy.email}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder={copy.emailPlaceholder}
                  required
                />
              </div>

              <div>
                <label className="label-field">{copy.password}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder={copy.passwordPlaceholder}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-3.5 text-sm"
              >
                {loading ? (
                  <>
                    <span className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    {copy.submitting}
                  </>
                ) : copy.submit}
              </button>
            </form>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-black/5 bg-white/60 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{copy.card1Title}</p>
                <p className="mt-2 text-sm font-medium text-neutral-800">{copy.card1Text}</p>
              </div>
              <div className="rounded-3xl border border-black/5 bg-white/60 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">{copy.card2Title}</p>
                <p className="mt-2 text-sm font-medium text-neutral-800">{copy.card2Text}</p>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-black/5 bg-white/45 px-4 py-3">
              <ProductSignature compact />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
