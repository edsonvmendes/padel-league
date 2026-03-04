'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BrandMark } from '@/components/BrandMark';
import { useToast } from '@/components/ToastProvider';
import { AppLocale, persistLocale, resolveClientLocale } from '@/lib/public-locale';
import { createClient } from '@/lib/supabase-browser';
import { PaymentMethod } from '@/types/database';

type PublicLeagueInfo = {
  id: string;
  name: string;
  weekday: string;
  is_finished: boolean;
};

const COPY: Record<AppLocale, Record<string, string>> = {
  pt: {
    requiredName: 'Nome obrigatorio.',
    alreadyExists: 'Seu nome ja esta cadastrado nesta liga.',
    closedLeague: 'Esta liga ja esta encerrada.',
    submitError: 'Nao foi possivel concluir seu cadastro agora.',
    submitSuccess: 'Cadastro enviado com sucesso.',
    loading: 'Carregando liga...',
    invalidTitle: 'Link invalido',
    invalidText: 'Nao encontramos uma liga ativa para este cadastro.',
    eyebrow: 'Cadastro por link',
    intro: 'Preencha seus dados para entrar na base da liga. Depois a organizadora segue com a montagem das rodadas.',
    finishedLeague: 'Esta liga esta encerrada e nao aceita novos cadastros.',
    received: 'Cadastro recebido. Voce ja pode fechar esta pagina.',
    fullName: 'Nome completo',
    yourName: 'Seu nome',
    phone: 'Telefone',
    birthdate: 'Nascimento',
    payment: 'Pagamento',
    notes: 'Observacoes',
    notesPlaceholder: 'Disponibilidade, nivel, observacoes...',
    submitting: 'Enviando...',
    submit: 'Entrar na base da liga',
    cash: 'Dinheiro',
    transfer: 'Transferencia',
    card: 'Cartao',
  },
  es: {
    requiredName: 'Nombre obligatorio.',
    alreadyExists: 'Tu nombre ya esta registrado en esta liga.',
    closedLeague: 'Esta liga ya esta cerrada.',
    submitError: 'No fue posible completar tu registro ahora.',
    submitSuccess: 'Registro enviado con exito.',
    loading: 'Cargando liga...',
    invalidTitle: 'Link invalido',
    invalidText: 'No encontramos una liga activa para este registro.',
    eyebrow: 'Registro por link',
    intro: 'Completa tus datos para entrar en la base de la liga. Despues la organizadora sigue con el armado de las jornadas.',
    finishedLeague: 'Esta liga esta cerrada y no acepta nuevos registros.',
    received: 'Registro recibido. Ya puedes cerrar esta pagina.',
    fullName: 'Nombre completo',
    yourName: 'Tu nombre',
    phone: 'Telefono',
    birthdate: 'Nacimiento',
    payment: 'Pago',
    notes: 'Observaciones',
    notesPlaceholder: 'Disponibilidad, nivel, observaciones...',
    submitting: 'Enviando...',
    submit: 'Entrar a la base de la liga',
    cash: 'Efectivo',
    transfer: 'Transferencia',
    card: 'Tarjeta',
  },
  en: {
    requiredName: 'Name is required.',
    alreadyExists: 'Your name is already registered in this league.',
    closedLeague: 'This league is already closed.',
    submitError: 'Could not complete your registration right now.',
    submitSuccess: 'Registration submitted successfully.',
    loading: 'Loading league...',
    invalidTitle: 'Invalid link',
    invalidText: 'We could not find an active league for this registration.',
    eyebrow: 'Link registration',
    intro: 'Fill in your details to join the league player base. After that, the organizer continues with round setup.',
    finishedLeague: 'This league is closed and is not accepting new registrations.',
    received: 'Registration received. You can close this page now.',
    fullName: 'Full name',
    yourName: 'Your name',
    phone: 'Phone',
    birthdate: 'Birthdate',
    payment: 'Payment',
    notes: 'Notes',
    notesPlaceholder: 'Availability, level, notes...',
    submitting: 'Submitting...',
    submit: 'Join the league base',
    cash: 'Cash',
    transfer: 'Transfer',
    card: 'Card',
  },
};

export default function PublicJoinPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const toast = useToast();
  const supabase = createClient();

  const [league, setLeague] = useState<PublicLeagueInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [locale, setLocale] = useState<AppLocale>('pt');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setLocale(resolveClientLocale());
  }, []);

  useEffect(() => {
    let active = true;

    const loadLeague = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_public_league_info', { p_league_id: leagueId });

      if (!active) return;

      if (error || !data || data.length === 0) {
        setLeague(null);
        setLoading(false);
        return;
      }

      setLeague(data[0] as PublicLeagueInfo);
      setLoading(false);
    };

    loadLeague().catch(() => {
      if (!active) return;
      setLeague(null);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [leagueId, supabase]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const copy = COPY[locale];

    if (!fullName.trim()) {
      toast.warning(copy.requiredName);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.rpc('public_register_player', {
      p_league_id: leagueId,
      p_full_name: fullName.trim(),
      p_birthdate: birthdate || null,
      p_payment: payment,
      p_phone: phone.trim() || null,
      p_notes: notes.trim() || null,
    });
    setSubmitting(false);

    if (error) {
      const message = error.message.includes('already exists')
        ? copy.alreadyExists
        : error.message.includes('closed')
          ? copy.closedLeague
          : copy.submitError;
      toast.error(message);
      return;
    }

    setSubmitted(true);
    setFullName('');
    setPhone('');
    setBirthdate('');
    setPayment('cash');
    setNotes('');
    toast.success(copy.submitSuccess);
  };

  const cycleLocale = () => {
    const next: AppLocale = locale === 'en' ? 'es' : locale === 'es' ? 'pt' : 'en';
    setLocale(next);
    persistLocale(next);
  };

  const copy = COPY[locale];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.14),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_30%),linear-gradient(145deg,#f8fafc,#eef2ff)] px-4 py-8">
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

        <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.28)] sm:p-8">
          {loading ? (
            <p className="text-center text-sm text-neutral-500">{copy.loading}</p>
          ) : !league ? (
            <div className="space-y-3 text-center">
              <h1 className="text-2xl font-black text-neutral-900">{copy.invalidTitle}</h1>
              <p className="text-sm text-neutral-500">{copy.invalidText}</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">{copy.eyebrow}</p>
                <h1 className="text-3xl font-black tracking-[-0.03em] text-neutral-950">{league.name}</h1>
                <p className="text-sm text-neutral-600">{copy.intro}</p>
                {league.is_finished && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {copy.finishedLeague}
                  </div>
                )}
                {submitted && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    {copy.received}
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="label-field">{copy.fullName}</label>
                  <input
                    className="input-field"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder={copy.yourName}
                    disabled={submitting || league.is_finished}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label-field">{copy.phone}</label>
                    <input
                      className="input-field"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+55 11 99999-9999"
                      disabled={submitting || league.is_finished}
                    />
                  </div>
                  <div>
                    <label className="label-field">{copy.birthdate}</label>
                    <input
                      type="date"
                      className="input-field"
                      value={birthdate}
                      onChange={(event) => setBirthdate(event.target.value)}
                      disabled={submitting || league.is_finished}
                    />
                  </div>
                </div>

                <div>
                  <label className="label-field">{copy.payment}</label>
                  <select
                    className="input-field"
                    value={payment}
                    onChange={(event) => setPayment(event.target.value as PaymentMethod)}
                    disabled={submitting || league.is_finished}
                  >
                    <option value="cash">{copy.cash}</option>
                    <option value="transfer">{copy.transfer}</option>
                    <option value="card">{copy.card}</option>
                  </select>
                </div>

                <div>
                  <label className="label-field">{copy.notes}</label>
                  <textarea
                    className="input-field min-h-[120px] resize-none"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder={copy.notesPlaceholder}
                    disabled={submitting || league.is_finished}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || league.is_finished}
                  className="btn-primary w-full justify-center disabled:opacity-60"
                >
                  {submitting ? copy.submitting : copy.submit}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
