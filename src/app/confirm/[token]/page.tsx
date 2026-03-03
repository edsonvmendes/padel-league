'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BrandMark } from '@/components/BrandMark';
import { useToast } from '@/components/ToastProvider';
import { createClient } from '@/lib/supabase-browser';

type PublicRoundConfirmation = {
  token: string;
  round_id: string;
  league_name: string;
  round_number: number;
  round_date: string;
  player_name: string;
  slot_time: string;
  court_number: number;
  status: 'pending' | 'present' | 'absent';
  substitute_name: string | null;
};

export default function PublicRoundConfirmationPage() {
  const { token } = useParams<{ token: string }>();
  const toast = useToast();
  const supabase = createClient();

  const [confirmation, setConfirmation] = useState<PublicRoundConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'present' | 'absent'>('present');
  const [substituteName, setSubstituteName] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_public_round_confirmation', { p_token: token });

      if (!active) return;

      if (error || !data || data.length === 0) {
        setConfirmation(null);
        setLoading(false);
        return;
      }

      const row = data[0] as PublicRoundConfirmation;
      setConfirmation(row);
      setStatus(row.status === 'absent' ? 'absent' : 'present');
      setSubstituteName(row.substitute_name || '');
      setLoading(false);
    };

    loadData().catch(() => {
      if (!active) return;
      setConfirmation(null);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [token, supabase]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    const { error } = await supabase.rpc('submit_public_round_confirmation', {
      p_token: token,
      p_status: status,
      p_substitute_name: status === 'absent' ? (substituteName.trim() || null) : null,
    });

    setSaving(false);

    if (error) {
      toast.error('Nao foi possivel registrar sua resposta agora.');
      return;
    }

    setDone(true);
    toast.success('Resposta registrada.');
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.14),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_30%),linear-gradient(145deg,#f8fafc,#ecfeff)] px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex justify-center">
          <BrandMark withWordmark size="sm" />
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.28)] sm:p-8">
          {loading ? (
            <p className="text-center text-sm text-neutral-500">Carregando convite...</p>
          ) : !confirmation ? (
            <div className="space-y-3 text-center">
              <h1 className="text-2xl font-black text-neutral-900">Link invalido</h1>
              <p className="text-sm text-neutral-500">Nao encontramos uma confirmacao ativa para este link.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Confirmacao de presenca</p>
                <h1 className="text-3xl font-black tracking-[-0.03em] text-neutral-950">{confirmation.league_name}</h1>
                <p className="text-sm text-neutral-600">
                  {confirmation.player_name}, responda sua presenca para a rodada {confirmation.round_number}.
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <InfoCard label="Rodada" value={`${confirmation.round_number}`} />
                <InfoCard label="Horario" value={confirmation.slot_time} />
                <InfoCard label="Cancha" value={`${confirmation.court_number}`} />
              </div>

              {done ? (
                <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Sua resposta ja foi registrada. Se precisar ajustar, abra o mesmo link novamente e envie outra resposta.
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setStatus('present')}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      status === 'present'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-neutral-200 bg-white text-neutral-700'
                    }`}
                  >
                    <div className="text-sm font-black">Vou jogar</div>
                    <div className="mt-1 text-xs text-current/80">Confirma sua presenca normal na rodada.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('absent')}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      status === 'absent'
                        ? 'border-amber-300 bg-amber-50 text-amber-800'
                        : 'border-neutral-200 bg-white text-neutral-700'
                    }`}
                  >
                    <div className="text-sm font-black">Nao vou</div>
                    <div className="mt-1 text-xs text-current/80">Marque ausencia e, se quiser, informe uma suplente.</div>
                  </button>
                </div>

                {status === 'absent' && (
                  <div>
                    <label className="label-field">Nome da suplente (opcional)</label>
                    <input
                      className="input-field"
                      value={substituteName}
                      onChange={(event) => setSubstituteName(event.target.value)}
                      placeholder="Quem pode entrar no seu lugar?"
                      disabled={saving}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary w-full justify-center disabled:opacity-60"
                >
                  {saving ? 'Enviando...' : 'Confirmar resposta'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">{label}</p>
      <p className="mt-1 text-lg font-black text-neutral-900">{value}</p>
    </div>
  );
}
