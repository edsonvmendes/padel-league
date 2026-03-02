'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BrandMark } from '@/components/BrandMark';
import { useToast } from '@/components/ToastProvider';
import { createClient } from '@/lib/supabase-browser';
import { PaymentMethod } from '@/types/database';

type PublicLeagueInfo = {
  id: string;
  name: string;
  weekday: string;
  is_finished: boolean;
};

export default function PublicJoinPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const toast = useToast();
  const supabase = createClient();

  const [league, setLeague] = useState<PublicLeagueInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');

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

    if (!fullName.trim()) {
      toast.warning('Nome obrigatorio.');
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
        ? 'Seu nome ja esta cadastrado nesta liga.'
        : error.message.includes('closed')
          ? 'Esta liga ja esta encerrada.'
          : 'Nao foi possivel concluir seu cadastro agora.';
      toast.error(message);
      return;
    }

    setSubmitted(true);
    setFullName('');
    setPhone('');
    setBirthdate('');
    setPayment('cash');
    setNotes('');
    toast.success('Cadastro enviado com sucesso.');
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.14),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_30%),linear-gradient(145deg,#f8fafc,#eef2ff)] px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex justify-center">
          <BrandMark withWordmark size="sm" />
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.28)] sm:p-8">
          {loading ? (
            <p className="text-center text-sm text-neutral-500">Carregando liga...</p>
          ) : !league ? (
            <div className="space-y-3 text-center">
              <h1 className="text-2xl font-black text-neutral-900">Link invalido</h1>
              <p className="text-sm text-neutral-500">Nao encontramos uma liga ativa para este cadastro.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Cadastro por link</p>
                <h1 className="text-3xl font-black tracking-[-0.03em] text-neutral-950">{league.name}</h1>
                <p className="text-sm text-neutral-600">
                  Preencha seus dados para entrar na base da liga. Depois a organizadora segue com a montagem das rodadas.
                </p>
                {league.is_finished && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Esta liga esta encerrada e nao aceita novos cadastros.
                  </div>
                )}
                {submitted && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    Cadastro recebido. Voce ja pode fechar esta pagina.
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="label-field">Nome completo</label>
                  <input
                    className="input-field"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Seu nome"
                    disabled={submitting || league.is_finished}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label-field">Telefone</label>
                    <input
                      className="input-field"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+55 11 99999-9999"
                      disabled={submitting || league.is_finished}
                    />
                  </div>
                  <div>
                    <label className="label-field">Nascimento</label>
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
                  <label className="label-field">Pagamento</label>
                  <select
                    className="input-field"
                    value={payment}
                    onChange={(event) => setPayment(event.target.value as PaymentMethod)}
                    disabled={submitting || league.is_finished}
                  >
                    <option value="cash">Dinheiro</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Cartao</option>
                  </select>
                </div>

                <div>
                  <label className="label-field">Observacoes</label>
                  <textarea
                    className="input-field min-h-[120px] resize-none"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Disponibilidade, nivel, observacoes..."
                    disabled={submitting || league.is_finished}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || league.is_finished}
                  className="btn-primary w-full justify-center disabled:opacity-60"
                >
                  {submitting ? 'Enviando...' : 'Entrar na base da liga'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
