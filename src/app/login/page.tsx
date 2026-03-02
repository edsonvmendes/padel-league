'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { BrandMark } from '@/components/BrandMark';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/app');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(212,163,74,0.22),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(12,155,138,0.18),_transparent_30%),linear-gradient(135deg,_#071218_0%,_#10272d_50%,_#18383c_100%)]" />
      <div className="absolute inset-y-0 right-0 -z-10 hidden lg:block w-[44vw] bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.12),_transparent_46%)]" />

      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="hidden lg:flex flex-col justify-between rounded-[2rem] border border-white/10 bg-white/5 p-10 text-white backdrop-blur-xl">
            <div className="space-y-8">
              <BrandMark withWordmark size="lg" />
              <div className="space-y-5">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300/90">Padel Operations</p>
                <h1 className="max-w-xl text-5xl font-black leading-[0.96] tracking-[-0.04em]">
                  Gestão de liga com presença de produto premium.
                </h1>
                <p className="max-w-lg text-base leading-7 text-white/72">
                  Centralize rodadas, jogadoras, configurações e operação semanal em uma experiência limpa,
                  rápida e com aparência de software sério.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-3xl font-black">12</p>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/55">Rodadas por temporada</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-3xl font-black">4x</p>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/55">Menos retrabalho manual</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-3xl font-black">1</p>
                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/55">Base operacional única</p>
              </div>
            </div>
          </section>

          <section className="surface-card mx-auto flex w-full max-w-xl flex-col justify-center p-6 sm:p-8 lg:p-10">
            <div className="mb-8 flex items-center justify-between">
              <BrandMark withWordmark />
              <div className="rounded-full border border-black/5 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                Secure Access
              </div>
            </div>

            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Bem-vinda de volta</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-neutral-900">Entrar na sua central</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-500">
                Acesse sua operação semanal, atualize rodadas e mantenha a liga organizada sem perder contexto.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="label-field">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="voce@seudominio.com"
                  required
                />
              </div>

              <div>
                <label className="label-field">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-3.5 text-sm">
                {loading ? (
                  <>
                    <span className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Entrando...
                  </>
                ) : 'Entrar agora'}
              </button>
            </form>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-black/5 bg-white/60 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Fluxo enxuto</p>
                <p className="mt-2 text-sm font-medium text-neutral-800">Rodadas, presença e placares no mesmo eixo operacional.</p>
              </div>
              <div className="rounded-3xl border border-black/5 bg-white/60 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Controle real</p>
                <p className="mt-2 text-sm font-medium text-neutral-800">Menos improviso na quadra e menos ruído administrativo.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
