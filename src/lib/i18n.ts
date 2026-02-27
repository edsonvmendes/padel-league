// ============================================================
// i18n — Padel League
// Locales: en | es | pt
// ============================================================

type Locale = 'en' | 'es' | 'pt';

const translations: Record<string, Record<Locale, string>> = {
  // Navigation
  dashboard:      { en: 'Dashboard',    es: 'Panel',          pt: 'Painel' },
  leagues:        { en: 'Leagues',      es: 'Ligas',          pt: 'Ligas' },
  players:        { en: 'Players',      es: 'Jugadoras',      pt: 'Jogadoras' },
  rounds:         { en: 'Rounds',       es: 'Jornadas',       pt: 'Rodadas' },
  ranking:        { en: 'Ranking',      es: 'Ranking',        pt: 'Ranking' },
  settings:       { en: 'Settings',     es: 'Configuración',  pt: 'Configurações' },
  adminRules:     { en: 'Admin Rules',  es: 'Reglas Admin',   pt: 'Regras Admin' },
  logout:         { en: 'Log out',      es: 'Salir',          pt: 'Sair' },
  back:           { en: 'Back',         es: 'Volver',         pt: 'Voltar' },

  // Status
  draft:          { en: 'Draft',        es: 'Borrador',       pt: 'Rascunho' },
  running:        { en: 'In progress',  es: 'En curso',       pt: 'Em andamento' },
  closed:         { en: 'Closed',       es: 'Cerrada',        pt: 'Fechada' },
  active:         { en: 'Active',       es: 'Activa',         pt: 'Ativa' },
  inactive:       { en: 'Inactive',     es: 'Inactiva',       pt: 'Inativa' },

  // Attendance
  present:        { en: 'Present',      es: 'Presente',       pt: 'Presente' },
  absent:         { en: 'Absent',       es: 'Ausente',        pt: 'Ausente' },
  substitute:     { en: 'Sub',          es: 'Suplente',       pt: 'Suplente' },

  // Players
  addPlayer:      { en: 'Add player',   es: 'Agregar jugadora', pt: 'Adicionar jogadora' },
  editPlayer:     { en: 'Edit player',  es: 'Editar jugadora',  pt: 'Editar jogadora' },
  searchPlayers:  { en: 'Search...',    es: 'Buscar...',         pt: 'Buscar...' },
  playerName:     { en: 'Name',         es: 'Nombre',            pt: 'Nome' },
  birthdate:      { en: 'Birthdate',    es: 'Fecha de nac.',     pt: 'Data de nasc.' },
  paymentMethod:  { en: 'Payment',      es: 'Pago',              pt: 'Pagamento' },
  notes:          { en: 'Notes',        es: 'Notas',             pt: 'Notas' },
  showActive:     { en: 'Active only',  es: 'Solo activas',      pt: 'Só ativas' },
  noPlayers:      { en: 'No players yet', es: 'Sin jugadoras',   pt: 'Sem jogadoras' },
  total:          { en: 'Total',        es: 'Total',             pt: 'Total' },

  // Rounds
  createRound:    { en: 'New round',    es: 'Nueva jornada',  pt: 'Nova rodada' },
  createLeague:   { en: 'New league',   es: 'Nueva liga',     pt: 'Nova liga' },
  noRounds:       { en: 'No rounds yet', es: 'Sin jornadas',  pt: 'Sem rodadas' },
  roundNumber:    { en: 'Round',        es: 'Jornada',        pt: 'Rodada' },
  roundN:         { en: 'Round {n}',    es: 'Jornada {n}',    pt: 'Rodada {n}' },

  // General
  loading:        { en: 'Loading...',   es: 'Cargando...',    pt: 'Carregando...' },
  error:          { en: 'Error',        es: 'Error',          pt: 'Erro' },
  save:           { en: 'Save',         es: 'Guardar',        pt: 'Salvar' },
  cancel:         { en: 'Cancel',       es: 'Cancelar',       pt: 'Cancelar' },
  delete:         { en: 'Delete',       es: 'Eliminar',       pt: 'Excluir' },
  edit:           { en: 'Edit',         es: 'Editar',         pt: 'Editar' },
  add:            { en: 'Add',          es: 'Agregar',        pt: 'Adicionar' },
  confirm:        { en: 'Confirm',      es: 'Confirmar',      pt: 'Confirmar' },
  noData:         { en: 'No data',      es: 'Sin datos',      pt: 'Sem dados' },
};

/**
 * Translate a key to the given locale.
 * Supports {n} interpolation via options.
 */
export function t(
  key: string,
  locale: string = 'pt',
  options?: Record<string, string | number>
): string {
  const loc = (['en', 'es', 'pt'].includes(locale) ? locale : 'pt') as Locale;
  let text = translations[key]?.[loc] ?? translations[key]?.['pt'] ?? key;

  if (options) {
    for (const [k, v] of Object.entries(options)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }

  return text;
}
