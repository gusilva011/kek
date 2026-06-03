"use client";

import { create } from "zustand";
import type {
  Banner,
  Bet,
  Branding,
  MarketKey,
  Match,
  PopularMultiple,
  Promotion,
  PublicUser,
  Transaction,
  Wallet,
} from "@/shared/types";
import { TENANT_NAME } from "@/shared/types";

export type ConnState = "connecting" | "open" | "closed";

export interface Toast {
  id: string;
  kind: "info" | "success" | "error";
  message: string;
}

export interface SlipSelection {
  matchId: string;
  matchLabel: string;
  league: string;
  marketKey: MarketKey;
  marketName: string;
  selectionId: string;
  selectionLabel: string;
  oddsAtPick: number;
}

export type StatusFilter = "all" | "live" | "upcoming";

export interface Filters {
  sport: string;
  league: string | null;
  columnMarket: MarketKey;
  status: StatusFilter;
  search: string;
  /** Dia selecionado (início do dia, ms) para os jogos pré-live; null = todos. */
  day: number | null;
}

interface StoreState {
  conn: ConnState;
  user: PublicUser | null;
  wallet: Wallet | null;
  matches: Record<string, Match>;
  bets: Record<string, Bet>;
  banners: Banner[];
  promotions: Promotion[];
  popularMultiples: PopularMultiple[];
  branding: Branding;
  transactions: Transaction[];
  slip: SlipSelection[];
  toasts: Toast[];
  filters: Filters;
  authOpen: boolean;
  authMode: "login" | "register";
  /** Gaveta inferior no mobile: bilhete, apostas ou fechada. */
  mobileSheet: "slip" | "bets" | null;
  /** Modal de carteira (depósito/saque). */
  walletModal: "deposit" | "withdraw" | null;
  /** Jogo aberto no modal de detalhe (todos os mercados). */
  detailMatchId: string | null;

  setConn: (c: ConnState) => void;
  setMobileSheet: (s: "slip" | "bets" | null) => void;
  openWallet: (tab: "deposit" | "withdraw") => void;
  closeWallet: () => void;
  openDetail: (matchId: string) => void;
  closeDetail: () => void;
  setFilters: (p: Partial<Filters>) => void;
  applySnapshot: (s: {
    user: PublicUser | null;
    matches: Match[];
    bets: Bet[];
    banners: Banner[];
    promotions: Promotion[];
    popularMultiples: PopularMultiple[];
    branding: Branding;
    transactions: Transaction[];
  }) => void;
  setUser: (u: PublicUser | null) => void;
  setTransactions: (t: Transaction[]) => void;
  upsertMatch: (m: Match) => void;
  /** Aplica vários jogos numa única atualização (1 render por tick). */
  upsertMatches: (list: Match[]) => void;
  removeMatch: (id: string) => void;
  setWallet: (w: Wallet) => void;
  upsertBet: (b: Bet) => void;
  setBanners: (b: Banner[]) => void;
  setPromotions: (p: Promotion[]) => void;
  setPopularMultiples: (m: PopularMultiple[]) => void;
  setBranding: (b: Branding) => void;
  addSelection: (s: SlipSelection) => void;
  removeSelection: (selectionId: string) => void;
  clearSlip: () => void;
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  openAuth: (mode: "login" | "register") => void;
  closeAuth: () => void;
}

let toastSeq = 0;

export const useStore = create<StoreState>((set) => ({
  conn: "connecting",
  user: null,
  wallet: null,
  matches: {},
  bets: {},
  banners: [],
  promotions: [],
  popularMultiples: [],
  branding: { brandName: TENANT_NAME },
  transactions: [],
  slip: [],
  toasts: [],
  filters: { sport: "football", league: null, columnMarket: "1x2", status: "all", search: "", day: null },
  authOpen: false,
  authMode: "login",
  mobileSheet: null,
  walletModal: null,
  detailMatchId: null,

  setConn: (conn) => set({ conn }),
  setMobileSheet: (mobileSheet) => set({ mobileSheet }),
  openWallet: (tab) => set({ walletModal: tab }),
  closeWallet: () => set({ walletModal: null }),
  openDetail: (detailMatchId) => set({ detailMatchId }),
  closeDetail: () => set({ detailMatchId: null }),
  setFilters: (p) => set((state) => ({ filters: { ...state.filters, ...p } })),

  applySnapshot: ({ user, matches, bets, banners, promotions, popularMultiples, branding, transactions }) =>
    set({
      user,
      wallet: user?.wallet ?? null,
      matches: Object.fromEntries(matches.map((m) => [m.id, m])),
      bets: Object.fromEntries(bets.map((b) => [b.id, b])),
      banners,
      promotions,
      popularMultiples,
      branding,
      transactions,
    }),

  setUser: (user) => set({ user, wallet: user?.wallet ?? null }),
  setTransactions: (transactions) => set({ transactions }),

  upsertMatch: (m) => set((state) => ({ matches: { ...state.matches, [m.id]: m } })),
  upsertMatches: (list) =>
    set((state) => {
      if (list.length === 0) return {} as Partial<StoreState>;
      const next = { ...state.matches };
      for (const m of list) next[m.id] = m;
      return { matches: next };
    }),
  removeMatch: (id) =>
    set((state) => {
      const next = { ...state.matches };
      delete next[id];
      return { matches: next };
    }),

  setWallet: (wallet) => set({ wallet }),
  upsertBet: (b) => set((state) => ({ bets: { ...state.bets, [b.id]: b } })),
  setBanners: (banners) => set({ banners }),
  setPromotions: (promotions) => set({ promotions }),
  setPopularMultiples: (popularMultiples) => set({ popularMultiples }),
  setBranding: (branding) => set({ branding }),
  addSelection: (sel) =>
    set((state) => ({
      // Uma seleção por jogo (clicar outro mercado do mesmo jogo substitui).
      slip: [...state.slip.filter((s) => s.matchId !== sel.matchId), sel],
    })),
  removeSelection: (selectionId) =>
    set((state) => ({ slip: state.slip.filter((s) => s.selectionId !== selectionId) })),
  clearSlip: () => set({ slip: [] }),

  pushToast: (t) =>
    set((state) => ({ toasts: [...state.toasts, { ...t, id: `t_${++toastSeq}` }].slice(-4) })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((x) => x.id !== id) })),

  openAuth: (authMode) => set({ authOpen: true, authMode }),
  closeAuth: () => set({ authOpen: false }),
}));
