'use client';

import { BookOpen, Calendar, CheckCircle2, Copy, Link as LinkIcon, Settings, Trophy, Users } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

type Step = {
  title: string;
  body: string;
};

type Capability = {
  title: string;
  detail: string;
  icon: React.ReactNode;
};

const STARTUP_STEPS: Record<'pt' | 'es' | 'en', Step[]> = {
  pt: [
    { title: '1. Criar a liga', body: 'Defina nome, dia base, quantidade de rodadas, quadras por horario e quantidade de quadras fisicas reais.' },
    { title: '2. Ajustar a estrutura', body: 'Em Configuracoes, monte os horarios, as quadras de nivel e as regras operacionais antes de abrir a primeira rodada.' },
    { title: '3. Montar a base de jogadoras', body: 'Cadastre manualmente, importe de outra liga sua ou copie o link publico de cadastro para as jogadoras entrarem sozinhas.' },
    { title: '4. Criar a rodada', body: 'Abra a rodada, escolha as quadras ativas e ajuste horario e quadra fisica por jogo quando precisar.' },
    { title: '5. Fechar e consolidar', body: 'Lance os placares como rascunho durante a operacao e feche a rodada para confirmar tudo de uma vez e atualizar o ranking.' },
  ],
  es: [
    { title: '1. Crear la liga', body: 'Define nombre, dia base, cantidad de jornadas, canchas por horario y cantidad de canchas fisicas reales.' },
    { title: '2. Ajustar la estructura', body: 'En Configuracion, arma los horarios, las canchas de nivel y las reglas operativas antes de abrir la primera jornada.' },
    { title: '3. Montar la base de jugadoras', body: 'Registra manualmente, importa desde otra liga tuya o copia el link publico para que las jugadoras se registren solas.' },
    { title: '4. Crear la jornada', body: 'Abre la jornada, elige las canchas activas y ajusta horario y cancha fisica por partido cuando haga falta.' },
    { title: '5. Cerrar y consolidar', body: 'Carga marcadores como borrador durante la operacion y cierra la jornada para confirmar todo de una vez y actualizar el ranking.' },
  ],
  en: [
    { title: '1. Create the league', body: 'Set the name, base weekday, total rounds, level courts per slot, and the number of real physical courts.' },
    { title: '2. Shape the structure', body: 'In Settings, define time slots, level courts, and operating rules before opening the first round.' },
    { title: '3. Build the roster', body: 'Add players manually, import from another league you own, or copy the public join link so players can self-register.' },
    { title: '4. Open the round', body: 'Create the round, choose the active courts, and adjust time slot and physical court per match when needed.' },
    { title: '5. Close and consolidate', body: 'Save scores as drafts during operations and close the round to confirm everything at once and refresh rankings.' },
  ],
};

const CAPABILITIES: Record<'pt' | 'es' | 'en', Capability[]> = {
  pt: [
    { title: 'Ligas', detail: 'Criar, duplicar e manter estruturas completas com regras, horarios, quadras e jogadoras ativas.', icon: <Calendar size={18} /> },
    { title: 'Jogadoras', detail: 'Cadastrar, editar, ativar, inativar, importar entre ligas e distribuir link publico de cadastro.', icon: <Users size={18} /> },
    { title: 'Rodadas', detail: 'Montar jogos, ajustar horario e quadra fisica, salvar placares em rascunho e fechar com confirmacao em lote.', icon: <CheckCircle2 size={18} /> },
    { title: 'Ranking', detail: 'Consolidar a pontuacao por diferenca de placar e acompanhar evolucao rodada a rodada.', icon: <Trophy size={18} /> },
    { title: 'Configuracoes', detail: 'Controlar horarios, quadras, regras e capacidade operacional da liga.', icon: <Settings size={18} /> },
    { title: 'Cadastro por link', detail: 'Enviar um link direto para que a jogadora se cadastre sozinha na base da liga.', icon: <LinkIcon size={18} /> },
  ],
  es: [
    { title: 'Ligas', detail: 'Crear, duplicar y mantener estructuras completas con reglas, horarios, canchas y jugadoras activas.', icon: <Calendar size={18} /> },
    { title: 'Jugadoras', detail: 'Registrar, editar, activar, desactivar, importar entre ligas y compartir un link publico de registro.', icon: <Users size={18} /> },
    { title: 'Jornadas', detail: 'Armar partidos, ajustar horario y cancha fisica, guardar marcadores en borrador y cerrar con confirmacion en lote.', icon: <CheckCircle2 size={18} /> },
    { title: 'Ranking', detail: 'Consolidar la puntuacion por diferencia de marcador y seguir la evolucion jornada a jornada.', icon: <Trophy size={18} /> },
    { title: 'Configuracion', detail: 'Controlar horarios, canchas, reglas y capacidad operativa de la liga.', icon: <Settings size={18} /> },
    { title: 'Registro por link', detail: 'Enviar un link directo para que la jugadora se registre sola en la base de la liga.', icon: <LinkIcon size={18} /> },
  ],
  en: [
    { title: 'Leagues', detail: 'Create, duplicate, and maintain full setups with rules, slots, courts, and active players.', icon: <Calendar size={18} /> },
    { title: 'Players', detail: 'Create, edit, activate, deactivate, import between leagues, and share a public self-registration link.', icon: <Users size={18} /> },
    { title: 'Rounds', detail: 'Build matches, adjust slot and physical court, save draft scores, and close with batch confirmation.', icon: <CheckCircle2 size={18} /> },
    { title: 'Ranking', detail: 'Consolidate score-difference points and track evolution round by round.', icon: <Trophy size={18} /> },
    { title: 'Settings', detail: 'Control slots, courts, rules, and the league operating capacity.', icon: <Settings size={18} /> },
    { title: 'Join by link', detail: 'Send a direct link so a player can add herself to the league roster.', icon: <LinkIcon size={18} /> },
  ],
};

const DAILY_FLOW: Record<'pt' | 'es' | 'en', Step[]> = {
  pt: [
    { title: 'Antes da rodada', body: 'Confira a base de jogadoras, importe quem faltou, valide horarios e copie o link de cadastro se entrar gente nova.' },
    { title: 'Durante a rodada', body: 'Monte os grupos, ajuste presenca e preencha o nome da suplente quando necessario. Lance os placares sem precisar confirmar cada partida na hora.' },
    { title: 'Depois da rodada', body: 'Feche a rodada para confirmar placares, calcular pontos, atualizar ranking e gerar o relatorio de WhatsApp no formato operacional.' },
  ],
  es: [
    { title: 'Antes de la jornada', body: 'Revisa la base de jugadoras, importa las faltantes, valida horarios y copia el link de registro si entra gente nueva.' },
    { title: 'Durante la jornada', body: 'Arma los grupos, ajusta asistencia y completa el nombre de la suplente cuando haga falta. Carga marcadores sin confirmar cada partido al instante.' },
    { title: 'Despues de la jornada', body: 'Cierra la jornada para confirmar marcadores, calcular puntos, actualizar ranking y generar el reporte de WhatsApp en formato operativo.' },
  ],
  en: [
    { title: 'Before the round', body: 'Review the roster, import missing players, validate slots, and copy the join link if new players are coming in.' },
    { title: 'During the round', body: 'Build groups, adjust attendance, and fill the substitute name when needed. Save scores without confirming each match immediately.' },
    { title: 'After the round', body: 'Close the round to confirm scores, calculate points, refresh rankings, and generate the operational WhatsApp report.' },
  ],
};

export default function ManualPage() {
  const { locale } = useAuth();
  const currentLocale = (locale === 'es' || locale === 'en' ? locale : 'pt') as 'pt' | 'es' | 'en';

  const title = currentLocale === 'pt'
    ? 'Manual de Operacao'
    : currentLocale === 'es'
      ? 'Manual Operativo'
      : 'Operations Manual';

  const subtitle = currentLocale === 'pt'
    ? 'Um guia completo para configurar, operar e escalar a liga sem perder o ritmo da semana.'
    : currentLocale === 'es'
      ? 'Una guia completa para configurar, operar y escalar la liga sin perder el ritmo semanal.'
      : 'A full guide to configure, operate, and scale the league without losing weekly momentum.';

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.2rem] border border-white/70 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.18),transparent_34%),radial-gradient(circle_at_20%_80%,rgba(56,189,248,0.16),transparent_30%),linear-gradient(155deg,rgba(255,255,255,0.98),rgba(241,245,249,0.96))] p-5 shadow-[0_34px_90px_-46px_rgba(15,23,42,0.4)] sm:p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
              <BookOpen size={13} />
              {currentLocale === 'pt' ? 'Playbook' : currentLocale === 'es' ? 'Playbook' : 'Playbook'}
            </span>
            <div>
              <h1 className="text-3xl font-black tracking-[-0.04em] text-neutral-950 sm:text-5xl">{title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600 sm:text-base">{subtitle}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
            <ManualStat
              label={currentLocale === 'pt' ? 'Blocos' : currentLocale === 'es' ? 'Bloques' : 'Blocks'}
              value="3"
              detail={currentLocale === 'pt' ? 'estrutura central' : currentLocale === 'es' ? 'estructura central' : 'core structure'}
            />
            <ManualStat
              label={currentLocale === 'pt' ? 'Funcoes' : currentLocale === 'es' ? 'Funciones' : 'Functions'}
              value={`${CAPABILITIES[currentLocale].length}`}
              detail={currentLocale === 'pt' ? 'mapeadas' : currentLocale === 'es' ? 'mapeadas' : 'mapped'}
            />
            <ManualStat
              label={currentLocale === 'pt' ? 'Fluxo' : currentLocale === 'es' ? 'Flujo' : 'Flow'}
              value="E2E"
              detail={currentLocale === 'pt' ? 'do inicio ao fechamento' : currentLocale === 'es' ? 'de inicio a cierre' : 'from setup to close'}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-white/70 bg-white/92 p-5 shadow-[0_22px_64px_-42px_rgba(15,23,42,0.25)] sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
            {currentLocale === 'pt' ? 'Inicio da operacao' : currentLocale === 'es' ? 'Inicio de la operacion' : 'Start-up flow'}
          </p>
          <div className="mt-4 space-y-4">
            {STARTUP_STEPS[currentLocale].map((step, index) => (
              <div key={step.title} className="flex gap-4 rounded-2xl border border-neutral-100 bg-neutral-50/80 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-teal-500 text-sm font-black text-white">
                  {index + 1}
                </div>
                <div>
                  <h2 className="text-sm font-black text-neutral-900 sm:text-base">{step.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-neutral-600">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/70 bg-[linear-gradient(155deg,rgba(15,23,42,0.98),rgba(15,35,53,0.96))] p-5 text-white shadow-[0_28px_72px_-38px_rgba(2,6,23,0.5)] sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            {currentLocale === 'pt' ? 'Fluxo semanal' : currentLocale === 'es' ? 'Flujo semanal' : 'Weekly flow'}
          </p>
          <div className="mt-4 space-y-4">
            {DAILY_FLOW[currentLocale].map((step) => (
              <div key={step.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h2 className="text-sm font-black text-white sm:text-base">{step.title}</h2>
                <p className="mt-2 text-sm leading-6 text-white/70">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/92 p-5 shadow-[0_22px_64px_-42px_rgba(15,23,42,0.25)] sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
              {currentLocale === 'pt' ? 'Mapa de funcoes' : currentLocale === 'es' ? 'Mapa de funciones' : 'Function map'}
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-neutral-950">
              {currentLocale === 'pt' ? 'Tudo o que ja esta disponivel' : currentLocale === 'es' ? 'Todo lo que ya esta disponible' : 'Everything currently available'}
            </h2>
          </div>
          <div className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            {currentLocale === 'pt' ? 'Operacao completa' : currentLocale === 'es' ? 'Operacion completa' : 'Full operation'}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {CAPABILITIES[currentLocale].map((item) => (
            <div key={item.title} className="rounded-[1.6rem] border border-neutral-100 bg-[linear-gradient(155deg,rgba(248,250,252,0.92),rgba(255,255,255,0.95))] p-4 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.22)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-700">
                {item.icon}
              </div>
              <h3 className="mt-4 text-base font-black text-neutral-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(155deg,rgba(236,253,245,0.9),rgba(240,249,255,0.92))] p-5 shadow-[0_22px_64px_-42px_rgba(15,23,42,0.22)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-700">
              {currentLocale === 'pt' ? 'Atalhos operacionais' : currentLocale === 'es' ? 'Atajos operativos' : 'Operational shortcuts'}
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-neutral-950">
              {currentLocale === 'pt' ? 'Use estes pontos para acelerar a semana' : currentLocale === 'es' ? 'Usa estos puntos para acelerar la semana' : 'Use these points to move faster each week'}
            </h2>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            <Copy size={13} />
            {currentLocale === 'pt' ? 'playbook ativo' : currentLocale === 'es' ? 'playbook activo' : 'active playbook'}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <ShortcutCard
            title={currentLocale === 'pt' ? 'Importar base' : currentLocale === 'es' ? 'Importar base' : 'Import roster'}
            detail={currentLocale === 'pt' ? 'Reaproveite jogadoras ativas de outra liga sem duplicar nomes.' : currentLocale === 'es' ? 'Reutiliza jugadoras activas de otra liga sin duplicar nombres.' : 'Reuse active players from another league without duplicating names.'}
          />
          <ShortcutCard
            title={currentLocale === 'pt' ? 'Link publico' : currentLocale === 'es' ? 'Link publico' : 'Public join link'}
            detail={currentLocale === 'pt' ? 'Copie o link de cadastro e envie direto para novas jogadoras.' : currentLocale === 'es' ? 'Copia el link de registro y envialo directo a nuevas jugadoras.' : 'Copy the join link and send it directly to new players.'}
          />
          <ShortcutCard
            title={currentLocale === 'pt' ? 'Fechamento em lote' : currentLocale === 'es' ? 'Cierre en lote' : 'Batch close'}
            detail={currentLocale === 'pt' ? 'Salve placares durante a rodada e confirme tudo apenas no fechamento.' : currentLocale === 'es' ? 'Guarda marcadores durante la jornada y confirma todo solo al cierre.' : 'Save scores during the round and confirm everything only when closing.'}
          />
        </div>
      </section>
    </div>
  );
}

function ManualStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[1.4rem] border border-white/80 bg-white/80 p-4 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.18)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-neutral-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-neutral-500">{detail}</p>
    </div>
  );
}

function ShortcutCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[1.6rem] border border-white/70 bg-white/70 p-4 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.14)]">
      <h3 className="text-sm font-black text-neutral-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-neutral-600">{detail}</p>
    </div>
  );
}
