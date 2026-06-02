/**
 * Contrato de domínio + protocolo WebSocket, compartilhado entre o servidor
 * (motor de simulação / gateway / ledger) e o cliente (Next.js).
 */

/** Esporte (futebol, basquete, tênis, mma, …). String para multi-esporte. */
export type Sport = "football" | (string & {});
export type MatchStatus = "upcoming" | "live" | "finished";
export type MarketKey = "1x2" | "ou25" | "btts" | (string & {});

export interface Selection {
  id: string;
  label: string;
  odds: number;
  suspended: boolean;
}

export interface Market {
  key: MarketKey;
  name: string;
  selections: Selection[];
}

export interface Score {
  home: number;
  away: number;
}

export interface Match {
  id: string;
  sport: Sport;
  league: string;
  home: string;
  away: string;
  status: MatchStatus;
  startsAt: number;
  minute: number;
  score: Score;
  markets: Market[];
  /** Chave do esporte no provedor (uso interno do feed real). */
  providerSportKey?: string;
  /** Mercados estendidos já carregados (detalhe do jogo). */
  marketsLoaded?: boolean;
  /** Logos/escudos fornecidos pelo provedor (ex.: API-Football). */
  homeLogo?: string;
  awayLogo?: string;
  leagueLogo?: string;
  leagueFlag?: string;
  country?: string;
}

export type BetStatus = "open" | "won" | "lost" | "cashed_out";

/** Perna de uma aposta múltipla (acumulada). */
export interface BetLeg {
  matchId: string;
  matchLabel: string;
  league: string;
  marketName: string;
  selectionId: string;
  selectionLabel: string;
  oddsLocked: number;
  status: "open" | "won" | "lost";
}

export interface Bet {
  id: string;
  matchId: string;
  matchLabel: string;
  league: string;
  marketKey: MarketKey;
  marketName: string;
  selectionId: string;
  selectionLabel: string;
  oddsLocked: number;
  stake: number;
  potentialReturn: number;
  status: BetStatus;
  placedAt: number;
  settledAt?: number;
  cashoutValue?: number;
  /** "single" (padrão) ou "multi" (acumulada com várias pernas). */
  kind?: "single" | "multi";
  legs?: BetLeg[];
}

export interface Wallet {
  balance: number;
  currency: string;
}

/* ------------------------------------------------------------------ */
/* Contas / Auth                                                       */
/* ------------------------------------------------------------------ */

export type Role = "user" | "admin";

/** Usuário como enviado ao cliente (nunca inclui hash de senha). */
export interface PublicUser {
  id: string;
  login: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  /** Data de nascimento (ISO YYYY-MM-DD). */
  birthDate: string;
  role: Role;
  wallet: Wallet;
  createdAt: number;
  /** Código de indicação do próprio usuário (programa de afiliados). */
  affiliateCode: string;
  /** Código do afiliado que indicou este usuário (se houver). */
  referredBy?: string;
}

export type TxType = "deposit" | "withdraw" | "bet" | "win" | "cashout" | "bonus" | "adjust";

export interface Transaction {
  id: string;
  type: TxType;
  /** Positivo = crédito, negativo = débito. */
  amount: number;
  balanceAfter: number;
  status: "completed" | "pending";
  description?: string;
  at: number;
}

/* ------------------------------------------------------------------ */
/* Banners / Promoções (configuráveis no backoffice)                   */
/* ------------------------------------------------------------------ */

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  /** Classe de gradiente Tailwind (ex.: "from-emerald-600 to-emerald-900"). */
  bg: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaHref?: string;
  active: boolean;
  order: number;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  badge?: string;
  terms?: string;
  ctaLabel?: string;
  active: boolean;
  createdAt: number;
}

export type BannerInput = Omit<Banner, "id"> & { id?: string };
export type PromotionInput = Omit<Promotion, "id" | "createdAt"> & { id?: string };

/** Identidade visual do tenant (white-label). */
export interface Branding {
  brandName: string;
  /** Logo como data URL (upload) — se ausente, usa o logo padrão. */
  logoDataUrl?: string;
}

/* ------------------------------------------------------------------ */
/* Backoffice — visão administrativa (CRM / métricas)                  */
/* ------------------------------------------------------------------ */

export interface AdminUserRow {
  id: string;
  login: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  role: Role;
  balance: number;
  createdAt: number;
  blocked: boolean;
  affiliateCode: string;
  referredBy?: string;
}

export interface AdminTxnRow {
  userId: string;
  type: TxType;
  amount: number;
  at: number;
}

export interface AdminBetRow {
  userId: string;
  stake: number;
  potentialReturn: number;
  status: BetStatus;
  kind: "single" | "multi";
  placedAt: number;
  settledAt?: number;
  cashoutValue?: number;
}

/** Dados brutos (resumidos) para o painel calcular métricas e filtrar por período. */
export interface AdminOverview {
  users: AdminUserRow[];
  transactions: AdminTxnRow[];
  bets: AdminBetRow[];
  affiliateConfig: AffiliateConfig;
  generatedAt: number;
}

/* ------------------------------------------------------------------ */
/* Afiliados                                                           */
/* ------------------------------------------------------------------ */

export interface AffiliateConfig {
  /** Fração do GGR dos indicados paga ao afiliado (0..1). */
  revSharePct: number;
}

export interface AffiliateReferral {
  login: string;
  name: string;
  createdAt: number;
  deposited: number;
  /** GGR gerado por este indicado (apostado − pago). */
  ggr: number;
}

/** Resumo do programa de afiliados para um usuário (painel do afiliado). */
export interface AffiliateSummary {
  code: string;
  revSharePct: number;
  totalReferrals: number;
  depositors: number;
  totalGgr: number;
  commission: number;
  referrals: AffiliateReferral[];
}

/* ------------------------------------------------------------------ */
/* Protocolo WebSocket — Servidor → Cliente                            */
/* ------------------------------------------------------------------ */

export type ServerMessage =
  | { type: "snapshot"; payload: SnapshotPayload }
  | { type: "match_update"; payload: Match }
  | { type: "matches_batch"; payload: Match[] }
  | { type: "match_removed"; payload: { matchId: string } }
  | { type: "wallet"; payload: Wallet }
  | { type: "bet_update"; payload: Bet }
  | { type: "bet_result"; payload: { bet: Bet; message: string } }
  | { type: "banners"; payload: Banner[] }
  | { type: "promotions"; payload: Promotion[] }
  | { type: "branding"; payload: Branding }
  | { type: "transactions"; payload: Transaction[] }
  | { type: "ack"; payload: AckPayload }
  | { type: "error"; payload: { message: string; refId?: string } };

export interface SnapshotPayload {
  tenantId: string;
  user: PublicUser | null;
  matches: Match[];
  bets: Bet[];
  banners: Banner[];
  promotions: Promotion[];
  branding: Branding;
  transactions: Transaction[];
  serverTime: number;
}

export interface AckPayload {
  refId: string;
  ok: boolean;
  message?: string;
  bet?: Bet;
  /** Em login/cadastro: token de sessão a guardar no cliente. */
  token?: string;
  /** Resposta de leitura (ex.: overview do backoffice). */
  data?: unknown;
}

/* ------------------------------------------------------------------ */
/* Protocolo WebSocket — Cliente → Servidor                            */
/* ------------------------------------------------------------------ */

export type ClientMessage =
  | {
      type: "register";
      refId: string;
      payload: {
        login: string;
        password: string;
        name: string;
        email: string;
        phone: string;
        cpf: string;
        birthDate: string;
        /** Código de indicação (programa de afiliados), se veio por link ?ref=. */
        ref?: string;
      };
    }
  | { type: "login"; refId: string; payload: { login: string; password: string } }
  | { type: "logout" }
  | { type: "deposit"; refId: string; payload: { amount: number } }
  | { type: "withdraw"; refId: string; payload: { amount: number } }
  | { type: "place_bet"; refId: string; payload: PlaceBetPayload }
  | { type: "place_multi"; refId: string; payload: MultiBetPayload }
  | { type: "load_markets"; refId: string; payload: { matchId: string } }
  | { type: "cashout"; refId: string; payload: { betId: string } }
  | { type: "admin_save_banner"; refId: string; payload: BannerInput }
  | { type: "admin_delete_banner"; refId: string; payload: { id: string } }
  | { type: "admin_save_promo"; refId: string; payload: PromotionInput }
  | { type: "admin_delete_promo"; refId: string; payload: { id: string } }
  | { type: "admin_save_branding"; refId: string; payload: Branding }
  | { type: "admin_overview"; refId: string }
  | { type: "admin_adjust_balance"; refId: string; payload: { userId: string; amount: number; reason?: string } }
  | { type: "admin_set_blocked"; refId: string; payload: { userId: string; blocked: boolean } }
  | { type: "admin_set_affiliate_rate"; refId: string; payload: { revSharePct: number } }
  | { type: "affiliate_summary"; refId: string }
  | { type: "ping" };

export interface PlaceBetPayload {
  matchId: string;
  marketKey: MarketKey;
  selectionId: string;
  stake: number;
  expectedOdds: number;
}

export interface MultiBetPayload {
  selections: { matchId: string; marketKey: MarketKey; selectionId: string; expectedOdds: number }[];
  stake: number;
}

/* ------------------------------------------------------------------ */
/* Constantes de negócio                                               */
/* ------------------------------------------------------------------ */

export const TENANT_ID = "brasilbet";
export const TENANT_NAME = "BrasilBet";
export const CURRENCY = "BRL";
/** Bônus fictício de boas-vindas (demo). */
export const STARTING_BALANCE = 1000;
export const CASHOUT_MARGIN = 0.05;
export const MAX_ODDS_DRIFT = 0.05;
