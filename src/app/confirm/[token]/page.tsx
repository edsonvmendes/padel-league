'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BrandMark } from '@/components/BrandMark';
import { useToast } from '@/components/ToastProvider';
import { AppLocale, persistLocale, resolveClientLocale } from '@/lib/public-locale';
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

const COPY: Record<AppLocale, Record<string, string>> = {
  pt: {
    saveError: 'Nao foi possivel registrar sua resposta agora.',
    saveSuccess: 'Resposta registrada.',
    loading: 'Carregando convite...',
    invalidTitle: 'Link invalido',
    invalidText: 'Nao encontramos uma confirmacao ativa para este link.',
    eyebrow: 'Confirmacao de presenca',
    intro: 'responda sua presenca para a rodada',
    round: 'Rodada',
    time: 'Horario',
    court: 'Cancha',
    alreadyDone: 'Sua resposta ja foi registrada. Se precisar ajustar, abra o mesmo link novamente e envie outra resposta.',
    presentTitle: 'Vou jogar',
    presentText: 'Confirma sua presenca normal na rodada.',
    absentTitle: 'Nao vou',
    absentText: 'Marque ausencia e, se quiser, informe uma suplente.',
    substitute: 'Nome da suplente (opcional)',
    substitutePlaceholder: 'Quem pode entrar no seu lugar?',
    saving: 'Enviando...',
    submit: 'Confirmar resposta',
  },
  es: {
    saveError: 'No fue posible registrar tu respuesta ahora.',
    saveSuccess: 'Respuesta registrada.',
    loading: 'Cargando invitacion...',
    invalidTitle: 'Link invalido',
    invalidText: 'No encontramos una confirmacion activa para este link.',
    eyebrow: 'Confirmacion de asistencia',
    intro: 'responde tu asistencia para la jornada',
    round: 'Jornada',
    time: 'Horario',
    court: 'Cancha',
    alreadyDone: 'Tu respuesta ya fue registrada. Si necesitas ajustarla, abre este mismo link y envia otra respuesta.',
    presentTitle: 'Voy a jugar',
    presentText: 'Confirma tu asistencia normal en la jornada.',
    absentTitle: 'No voy',
    absentText: 'Marca ausencia y, si quieres, informa una suplente.',
    substitute: 'Nombre de la suplente (opcional)',
    substitutePlaceholder: 'Quien puede entrar en tu lugar?',
    saving: 'Enviando...',
    submit: 'Confirmar respuesta',
  },
  en: {
    saveError: 'Could not record your response right now.',
    saveSuccess: 'Response recorded.',
    loading: 'Loading invitation...',
    invalidTitle: 'Invalid link',
    invalidText: 'We could not find an active confirmation for this link.',
    eyebrow: 'Attendance confirmation',
    intro: 'please confirm your attendance for round',
    round: 'Round',
    time: 'Time',
    court: 'Court',
    alreadyDone: 'Your response has already been recorded. If you need to change it, open this same link and submit again.',
    presentTitle: 'I will play',
    presentText: 'Confirm your normal attendance for this round.',
    absentTitle: 'I cannot attend',
    absentText: 'Mark yourself absent and, if you want, provide a substitute.',
    substitute: 'Substitute name (optional)',
    substitutePlaceholder: 'Who can take your place?',
    saving: 'Submitting...',
    submit: 'Confirm response',
  },
};

export default function PublicRoundConfirmationPage() {
  const { token } = useParams<{ token: string }>();
  const toast = useToast();
  const supabase = createClient();

  const [confirmation, setConfirmation] = useState<PublicRoundConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locale, setLocale] = useState<AppLocale>('pt');
  const [status, setStatus] = useState<'present' | 'absent'>('present');
  const [substituteName, setSubstituteName] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setLocale(resolveClientLocale());
  }, []);

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
    const copy = COPY[locale];
    setSaving(true);

    const { error } = await supabase.rpc('submit_public_round_confirmation', {
      p_token: token,
      p_status: status,
      p_substitute_name: status === 'absent' ? (substituteName.trim() || null) : null,
    });

    setSaving(false);

    if (error) {
      toast.error(copy.saveError);
      return;
    }

    setDone(true);
    toast.success(copy.saveSuccess);
  };

  const cycleLocale = () => {
    const next: AppLocale = locale === 'en' ? 'es' : locale === 'es' ? 'pt' : 'en';
    setLocale(next);
    persistLocale(next);
  };

  const copy = COPY[locale];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.14),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_30%),linear-gradient(145deg,#f8fafc,#ecfeff)] px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <BrandMark withWordmark size="sm" />
          <button
            type="button"
            onClick={cycleLocale}
            className="rounded-full border border-black/5 bg-white/78 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500"
          >
            {locale.toUpperCase()}
          </button>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.28)] sm:p-8">
          {loading ? (
            <p className="text-center text-sm text-neutral-500">{copy.loading}</p>
          ) : !confirmation ? (
            <div className="space-y-3 text-center">
              <h1 className="text-2xl font-black text-neutral-900">{copy.invalidTitle}</h1>
              <p className="text-sm text-neutral-500">{copy.invalidText}</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">{copy.eyebrow}</p>
                <h1 className="text-3xl font-black tracking-[-0.03em] text-neutral-950">{confirmation.league_name}</h1>
                <p className="text-sm text-neutral-600">
                  {confirmation.player_name}, {copy.intro} {confirmation.round_number}.
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <InfoCard label={copy.round} value={`${confirmation.round_number}`} />
                <InfoCard label={copy.time} value={confirmation.slot_time} />
                <InfoCard label={copy.court} value={`${confirmation.court_number}`} />
              </div>

              {done ? (
                <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {copy.alreadyDone}
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
                    <div className="text-sm font-black">{copy.presentTitle}</div>
                    <div className="mt-1 text-xs text-current/80">{copy.presentText}</div>
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
                    <div className="text-sm font-black">{copy.absentTitle}</div>
                    <div className="mt-1 text-xs text-current/80">{copy.absentText}</div>
                  </button>
                </div>

                {status === 'absent' && (
                  <div>
                    <label className="label-field">{copy.substitute}</label>
                    <input
                      className="input-field"
                      value={substituteName}
                      onChange={(event) => setSubstituteName(event.target.value)}
                      placeholder={copy.substitutePlaceholder}
                      disabled={saving}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary w-full justify-center disabled:opacity-60"
                >
                  {saving ? copy.saving : copy.submit}
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
