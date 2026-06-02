/**
 * Store / ledger da plataforma (estágio demo, persistido em JSON).
 *
 * Responsável por: contas (auth), carteiras, apostas (incl. liquidação e
 * cashout) e o conteúdo configurável (banners e promoções). A API pública não
 * muda quando trocarmos a persistência por Postgres.
 */

import type {
  AdminBetRow,
  AdminOverview,
  AdminTxnRow,
  AdminUserRow,
  AffiliateConfig,
  AffiliateReferral,
  AffiliateSummary,
  Banner,
  BannerInput,
  Bet,
  BetLeg,
  Branding,
  MarketKey,
  Promotion,
  PromotionInput,
  PublicUser,
  Role,
  Score,
  Transaction,
  TxType,
  Wallet,
} from "../shared/types";
import { STARTING_BALANCE, CURRENCY, TENANT_NAME } from "../shared/types";
import { makeSelectionId } from "../shared/ids";
import {
  hashPassword,
  verifyPassword,
  newToken,
  newId,
  newAffiliateCode,
  normalizePhone,
  normalizeCpf,
  validateRegistration,
  type RegistrationInput,
} from "./auth";
import { loadJson, saveJson } from "./persist";
import { generateDemoDataset } from "./demoData";

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export interface StoredUser {
  id: string;
  login: string;
  loginLower: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string;
  passwordSalt: string;
  passwordHash: string;
  role: Role;
  wallet: Wallet;
  transactions: Transaction[];
  createdAt: number;
  blocked?: boolean;
  affiliateCode: string;
  /** ID do afiliado que indicou este usuário. */
  referredBy?: string;
  /** Conta sintética do acervo de demonstração (não é cliente real). */
  demo?: boolean;
}

export interface StoredBet {
  bet: Bet;
  ownerUserId: string;
}

interface StoredSession {
  userId: string;
  createdAt: number;
  expiresAt: number;
}

type AuthResult =
  | { ok: true; user: PublicUser; token: string }
  | { ok: false; error: string };

export interface PlaceBetInput {
  matchId: string;
  matchLabel: string;
  league: string;
  marketKey: MarketKey;
  marketName: string;
  selectionId: string;
  selectionLabel: string;
  oddsLocked: number;
  stake: number;
}

export interface SettlementResult {
  userId: string;
  bet: Bet;
  wallet: Wallet;
}

let betCounter = 0;

export class Store {
  private users = new Map<string, StoredUser>();
  private bets = new Map<string, StoredBet>();
  private banners: Banner[] = [];
  private promotions: Promotion[] = [];
  private branding: Branding = { brandName: TENANT_NAME };
  private affiliateConfig: AffiliateConfig = { revSharePct: 0.3 };
  /** token de sessão -> dados (persistido em sessions.json; sobrevive ao restart). */
  private sessions = new Map<string, StoredSession>();
  private static readonly SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 dias

  constructor() {
    this.load();
    this.seed();
    this.maybeSeedDemo();
  }

  /* ---------------- persistência ---------------- */

  private load(): void {
    for (const u of loadJson<StoredUser[]>("users.json", [])) {
      // Migração de contas salvas antes dos campos novos.
      if (!Array.isArray(u.transactions)) u.transactions = [];
      if (typeof u.cpf !== "string") u.cpf = "";
      if (typeof u.name !== "string") u.name = u.login;
      if (typeof u.email !== "string") u.email = "";
      if (typeof u.birthDate !== "string") u.birthDate = "";
      if (typeof u.affiliateCode !== "string" || !u.affiliateCode) u.affiliateCode = newAffiliateCode();
      this.users.set(u.id, u);
    }
    for (const sb of loadJson<StoredBet[]>("bets.json", [])) {
      this.bets.set(sb.bet.id, sb);
      // Só os IDs canônicos (b_<n>) alimentam o contador; apostas do acervo
      // demo usam outro prefixo e não devem inflar a numeração real.
      const m = /^b_(\d+)$/.exec(sb.bet.id);
      if (m && Number(m[1]) > betCounter) betCounter = Number(m[1]);
    }
    this.banners = loadJson<Banner[]>("banners.json", []);
    this.promotions = loadJson<Promotion[]>("promotions.json", []);
    this.branding = loadJson<Branding>("branding.json", { brandName: TENANT_NAME });
    this.affiliateConfig = loadJson<AffiliateConfig>("affiliate.json", { revSharePct: 0.3 });
    this.loadSessions();
  }

  private saveUsers() {
    saveJson("users.json", Array.from(this.users.values()));
  }
  private saveBets() {
    saveJson("bets.json", Array.from(this.bets.values()));
  }

  /* ---------------- sessões (persistidas, com expiração) ---------------- */

  private loadSessions(): void {
    const now = Date.now();
    for (const s of loadJson<Array<{ token: string } & StoredSession>>("sessions.json", [])) {
      if (s.token && s.expiresAt > now) {
        this.sessions.set(s.token, { userId: s.userId, createdAt: s.createdAt, expiresAt: s.expiresAt });
      }
    }
  }

  private saveSessions(): void {
    const arr = Array.from(this.sessions.entries()).map(([token, s]) => ({ token, ...s }));
    saveJson("sessions.json", arr);
  }

  private createSession(userId: string): string {
    const token = newToken();
    const now = Date.now();
    this.sessions.set(token, { userId, createdAt: now, expiresAt: now + Store.SESSION_TTL });
    this.saveSessions();
    return token;
  }

  private seed(): void {
    if (this.users.size === 0) {
      const { salt, hash } = hashPassword("admin123");
      const admin: StoredUser = {
        id: newId("usr"),
        login: "admin",
        loginLower: "admin",
        name: "Administrador",
        email: "admin@brasilbet.local",
        phone: "00000000000",
        cpf: "",
        birthDate: "",
        passwordSalt: salt,
        passwordHash: hash,
        role: "admin",
        wallet: { balance: 0, currency: CURRENCY },
        transactions: [],
        createdAt: Date.now(),
        affiliateCode: newAffiliateCode(),
      };
      this.users.set(admin.id, admin);
      this.saveUsers();
    }
    if (this.banners.length === 0) {
      this.banners = [
        {
          id: newId("bnr"),
          title: `Bem-vindo à ${TENANT_NAME}`,
          subtitle: "Cadastre-se e ganhe R$ 1.000 em saldo de boas-vindas (fictício).",
          bg: "from-emerald-600 to-emerald-900",
          ctaLabel: "Criar conta",
          ctaHref: "#cadastro",
          active: true,
          order: 0,
        },
        {
          id: newId("bnr"),
          title: "Futebol ao vivo, odds em tempo real",
          subtitle: "Aposte nos principais jogos com cashout a qualquer momento.",
          bg: "from-sky-700 to-indigo-900",
          ctaLabel: "Ver jogos",
          ctaHref: "#jogos",
          active: true,
          order: 1,
        },
      ];
      saveJson("banners.json", this.banners);
    }
    if (this.promotions.length === 0) {
      this.promotions = [
        {
          id: newId("promo"),
          title: "Bônus de boas-vindas",
          description: "Novos clientes começam com R$ 1.000 de saldo para conhecer a plataforma.",
          badge: "Novo cliente",
          terms: "Saldo fictício, válido apenas na versão demonstrativa.",
          ctaLabel: "Quero meu bônus",
          active: true,
          createdAt: Date.now(),
        },
        {
          id: newId("promo"),
          title: "Cashout em todos os jogos",
          description: "Encerre sua aposta antes do fim e garanta o lucro — disponível em todos os eventos ao vivo.",
          badge: "Sempre ativo",
          terms: "Valor de cashout sujeito às odds do momento.",
          ctaLabel: "Saiba mais",
          active: true,
          createdAt: Date.now() - 1000,
        },
      ];
      saveJson("promotions.json", this.promotions);
    }
  }

  /**
   * Popular o acervo de DEMONSTRAÇÃO (clientes + apostas sintéticos), uma única
   * vez, só em modo demo. Faz o backoffice parecer um operador real e ativo.
   * Idempotente via marcador em disco; aditivo (preserva contas reais).
   */
  private maybeSeedDemo(): void {
    if (process.env.ODDS_PROVIDER !== "demo") return;
    if (loadJson<{ seeded?: boolean } | null>("demo-seeded.json", null)?.seeded) return;

    // Não semear por cima de uma base já populada (operador real).
    const realPlayers = Array.from(this.users.values()).filter((u) => u.role === "user" && !u.demo).length;
    if (realPlayers > 60) {
      saveJson("demo-seeded.json", { seeded: true, skipped: true, at: Date.now() });
      return;
    }

    const { users, bets } = generateDemoDataset();
    for (const u of users) this.users.set(u.id, u);
    for (const sb of bets) this.bets.set(sb.bet.id, sb);
    this.saveUsers();
    this.saveBets();
    saveJson("demo-seeded.json", { seeded: true, count: users.length, bets: bets.length, at: Date.now() });
    console.log(`[demo] acervo CRM semeado: ${users.length} clientes, ${bets.length} apostas (idempotente).`);
  }

  /* ---------------- auth ---------------- */

  publicUser(u: StoredUser): PublicUser {
    return {
      id: u.id,
      login: u.login,
      name: u.name,
      email: u.email,
      phone: u.phone,
      cpf: u.cpf,
      birthDate: u.birthDate,
      role: u.role,
      wallet: u.wallet,
      createdAt: u.createdAt,
      affiliateCode: u.affiliateCode,
      referredBy: u.referredBy,
    };
  }

  register(input: RegistrationInput): AuthResult {
    const err = validateRegistration(input);
    if (err) return { ok: false, error: err };
    const loginLower = input.login.trim().toLowerCase();
    const cpfDigits = normalizeCpf(input.cpf);
    const emailNorm = input.email.trim().toLowerCase();
    for (const u of this.users.values()) {
      if (u.loginLower === loginLower) return { ok: false, error: "Este login já está em uso." };
      if (u.email && u.email === emailNorm) return { ok: false, error: "Já existe uma conta com este e-mail." };
      if (u.cpf && u.cpf === cpfDigits) return { ok: false, error: "Já existe uma conta com este CPF." };
    }
    // Código de afiliado único + vínculo de indicação (se veio por ?ref=).
    const existingCodes = new Set(Array.from(this.users.values()).map((u) => u.affiliateCode));
    let affiliateCode = newAffiliateCode();
    while (existingCodes.has(affiliateCode)) affiliateCode = newAffiliateCode();
    let referredBy: string | undefined;
    if (input.ref) {
      const refCode = input.ref.trim().toUpperCase();
      const affiliate = Array.from(this.users.values()).find((u) => u.affiliateCode === refCode);
      if (affiliate) referredBy = affiliate.id;
    }

    const { salt, hash } = hashPassword(input.password);
    const user: StoredUser = {
      id: newId("usr"),
      login: input.login.trim(),
      loginLower,
      name: input.name.trim(),
      email: emailNorm,
      phone: normalizePhone(input.phone),
      cpf: cpfDigits,
      birthDate: input.birthDate,
      passwordSalt: salt,
      passwordHash: hash,
      role: "user",
      wallet: { balance: 0, currency: CURRENCY },
      transactions: [],
      createdAt: Date.now(),
      affiliateCode,
      referredBy,
    };
    // Bônus de boas-vindas (registrado como transação).
    user.wallet.balance = STARTING_BALANCE;
    this.addTxn(user, "bonus", STARTING_BALANCE, "completed", "Bônus de boas-vindas");
    this.users.set(user.id, user);
    this.saveUsers();
    const token = this.createSession(user.id);
    return { ok: true, user: this.publicUser(user), token };
  }

  private addTxn(user: StoredUser, type: TxType, amount: number, status: Transaction["status"], description?: string): void {
    user.transactions.unshift({
      id: newId("tx"),
      type,
      amount: round2(amount),
      balanceAfter: user.wallet.balance,
      status,
      description,
      at: Date.now(),
    });
    if (user.transactions.length > 100) user.transactions.length = 100;
  }

  getTransactions(userId: string): Transaction[] {
    return this.users.get(userId)?.transactions ?? [];
  }

  /** Depósito simulado (demo). Em produção, confirmado pelo gateway de pagamento. */
  deposit(userId: string, amount: number): { ok: boolean; error?: string } {
    const user = this.users.get(userId);
    if (!user) return { ok: false, error: "Sessão inválida." };
    const v = round2(amount);
    if (!Number.isFinite(v) || v <= 0) return { ok: false, error: "Valor inválido." };
    if (v > 50000) return { ok: false, error: "Valor máximo de depósito (demo): R$ 50.000." };
    user.wallet.balance = round2(user.wallet.balance + v);
    this.addTxn(user, "deposit", v, "completed", "Depósito via Pix (demo)");
    this.saveUsers();
    return { ok: true };
  }

  /** Saque via Pix — só para o titular (Pix = CPF cadastrado). Simulado (demo). */
  withdraw(userId: string, amount: number): { ok: boolean; error?: string } {
    const user = this.users.get(userId);
    if (!user) return { ok: false, error: "Sessão inválida." };
    if (!user.cpf) return { ok: false, error: "Cadastre um CPF para sacar." };
    const v = round2(amount);
    if (!Number.isFinite(v) || v <= 0) return { ok: false, error: "Valor inválido." };
    if (v > user.wallet.balance) return { ok: false, error: "Saldo insuficiente." };
    user.wallet.balance = round2(user.wallet.balance - v);
    this.addTxn(user, "withdraw", -v, "pending", "Saque Pix p/ CPF do titular");
    this.saveUsers();
    return { ok: true };
  }

  login(login: string, password: string): AuthResult {
    const loginLower = (login ?? "").trim().toLowerCase();
    const user = Array.from(this.users.values()).find((u) => u.loginLower === loginLower);
    if (!user || !verifyPassword(password ?? "", user.passwordSalt, user.passwordHash)) {
      return { ok: false, error: "Login ou senha incorretos." };
    }
    if (user.blocked) {
      return { ok: false, error: "Conta suspensa. Entre em contato com o suporte." };
    }
    const token = this.createSession(user.id);
    return { ok: true, user: this.publicUser(user), token };
  }

  logout(token: string): void {
    if (this.sessions.delete(token)) this.saveSessions();
  }

  userByToken(token: string | null | undefined): StoredUser | undefined {
    if (!token) return undefined;
    const s = this.sessions.get(token);
    if (!s) return undefined;
    if (s.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      this.saveSessions();
      return undefined;
    }
    return this.users.get(s.userId);
  }

  getWallet(userId: string): Wallet | null {
    return this.users.get(userId)?.wallet ?? null;
  }

  getUserPublic(userId: string): PublicUser | null {
    const u = this.users.get(userId);
    return u ? this.publicUser(u) : null;
  }

  /* ---------------- apostas ---------------- */

  getBets(userId: string): Bet[] {
    return Array.from(this.bets.values())
      .filter((sb) => sb.ownerUserId === userId)
      .map((sb) => sb.bet)
      .sort((a, b) => b.placedAt - a.placedAt);
  }

  getBet(userId: string, betId: string): Bet | undefined {
    const stored = this.bets.get(betId);
    if (!stored || stored.ownerUserId !== userId) return undefined;
    return stored.bet;
  }

  placeBet(userId: string, input: PlaceBetInput): { ok: boolean; bet?: Bet; error?: string } {
    const user = this.users.get(userId);
    if (!user) return { ok: false, error: "Faça login para apostar." };

    const stake = round2(input.stake);
    if (!Number.isFinite(stake) || stake <= 0) return { ok: false, error: "Valor de aposta inválido." };
    if (stake > user.wallet.balance) return { ok: false, error: "Saldo insuficiente." };

    const bet: Bet = {
      id: `b_${++betCounter}`,
      matchId: input.matchId,
      matchLabel: input.matchLabel,
      league: input.league,
      marketKey: input.marketKey,
      marketName: input.marketName,
      selectionId: input.selectionId,
      selectionLabel: input.selectionLabel,
      oddsLocked: input.oddsLocked,
      stake,
      potentialReturn: round2(stake * input.oddsLocked),
      status: "open",
      placedAt: Date.now(),
    };

    user.wallet.balance = round2(user.wallet.balance - stake);
    this.addTxn(user, "bet", -stake, "completed", `Aposta: ${input.selectionLabel}`);
    this.bets.set(bet.id, { bet, ownerUserId: userId });
    this.saveUsers();
    this.saveBets();
    return { ok: true, bet };
  }

  /** Aposta múltipla (acumulada): uma aposta, odds multiplicadas, ganha se todas as pernas ganharem. */
  placeMulti(
    userId: string,
    legs: Omit<BetLeg, "status">[],
    stake: number,
  ): { ok: boolean; bet?: Bet; error?: string } {
    const user = this.users.get(userId);
    if (!user) return { ok: false, error: "Faça login para apostar." };
    if (legs.length < 2) return { ok: false, error: "A múltipla precisa de ao menos 2 seleções." };

    const s = round2(stake);
    if (!Number.isFinite(s) || s <= 0) return { ok: false, error: "Valor de aposta inválido." };
    if (s > user.wallet.balance) return { ok: false, error: "Saldo insuficiente." };

    const combined = round2(legs.reduce((p, l) => p * l.oddsLocked, 1));
    const bet: Bet = {
      id: `b_${++betCounter}`,
      matchId: "",
      matchLabel: `Múltipla · ${legs.length} seleções`,
      league: "",
      marketKey: "1x2",
      marketName: "Múltipla",
      selectionId: "",
      selectionLabel: `${legs.length} seleções`,
      oddsLocked: combined,
      stake: s,
      potentialReturn: round2(s * combined),
      status: "open",
      placedAt: Date.now(),
      kind: "multi",
      legs: legs.map((l) => ({ ...l, status: "open" as const })),
    };

    user.wallet.balance = round2(user.wallet.balance - s);
    this.addTxn(user, "bet", -s, "completed", `Múltipla (${legs.length} seleções)`);
    this.bets.set(bet.id, { bet, ownerUserId: userId });
    this.saveUsers();
    this.saveBets();
    return { ok: true, bet };
  }

  creditCashout(userId: string, betId: string, value: number): { ok: boolean; bet?: Bet; error?: string } {
    const stored = this.bets.get(betId);
    if (!stored || stored.ownerUserId !== userId) return { ok: false, error: "Aposta não encontrada." };
    if (stored.bet.status !== "open") return { ok: false, error: "Esta aposta não está mais aberta." };
    const user = this.users.get(userId);
    if (!user) return { ok: false, error: "Sessão inválida." };

    const credit = round2(value);
    stored.bet.status = "cashed_out";
    stored.bet.cashoutValue = credit;
    stored.bet.settledAt = Date.now();
    user.wallet.balance = round2(user.wallet.balance + credit);
    this.addTxn(user, "cashout", credit, "completed", "Cashout");
    this.saveUsers();
    this.saveBets();
    return { ok: true, bet: stored.bet };
  }

  settleMatch(matchId: string, finalScore: Score): SettlementResult[] {
    const winners = this.winningSelectionIds(matchId, finalScore);
    const results: SettlementResult[] = [];

    for (const stored of this.bets.values()) {
      const bet = stored.bet;
      if (bet.status !== "open") continue;
      const user = this.users.get(stored.ownerUserId);
      if (!user) continue;

      // --- múltipla ---
      if (bet.kind === "multi" && bet.legs) {
        let changed = false;
        for (const leg of bet.legs) {
          if (leg.matchId === matchId && leg.status === "open") {
            leg.status = winners.has(leg.selectionId) ? "won" : "lost";
            changed = true;
          }
        }
        if (!changed) continue;
        if (bet.legs.some((l) => l.status === "lost")) {
          bet.status = "lost";
          bet.settledAt = Date.now();
        } else if (bet.legs.every((l) => l.status === "won")) {
          bet.status = "won";
          bet.settledAt = Date.now();
          user.wallet.balance = round2(user.wallet.balance + bet.potentialReturn);
          this.addTxn(user, "win", bet.potentialReturn, "completed", "Múltipla vencedora");
        }
        results.push({ userId: stored.ownerUserId, bet, wallet: user.wallet });
        continue;
      }

      // --- simples ---
      if (bet.matchId !== matchId) continue;
      if (winners.has(bet.selectionId)) {
        bet.status = "won";
        user.wallet.balance = round2(user.wallet.balance + bet.potentialReturn);
        this.addTxn(user, "win", bet.potentialReturn, "completed", "Aposta vencedora");
      } else {
        bet.status = "lost";
      }
      bet.settledAt = Date.now();
      results.push({ userId: stored.ownerUserId, bet, wallet: user.wallet });
    }
    if (results.length > 0) {
      this.saveUsers();
      this.saveBets();
    }
    return results;
  }

  private winningSelectionIds(matchId: string, score: Score): Set<string> {
    const ids = new Set<string>();
    const r = score.home > score.away ? "home" : score.home === score.away ? "draw" : "away";
    ids.add(makeSelectionId(matchId, "1x2", r));
    ids.add(makeSelectionId(matchId, "ou25", score.home + score.away > 2.5 ? "over" : "under"));
    ids.add(makeSelectionId(matchId, "btts", score.home > 0 && score.away > 0 ? "yes" : "no"));
    return ids;
  }

  /* ---------------- backoffice (admin) ---------------- */

  /** Dados brutos (resumidos) para o painel: o cliente agrega e filtra por período. */
  getAdminOverview(): AdminOverview {
    const users: AdminUserRow[] = [];
    const transactions: AdminTxnRow[] = [];
    for (const u of this.users.values()) {
      users.push({
        id: u.id,
        login: u.login,
        name: u.name,
        email: u.email,
        phone: u.phone,
        cpf: u.cpf,
        role: u.role,
        balance: u.wallet.balance,
        createdAt: u.createdAt,
        blocked: !!u.blocked,
        affiliateCode: u.affiliateCode,
        referredBy: u.referredBy,
      });
      for (const t of u.transactions) {
        transactions.push({ userId: u.id, type: t.type, amount: t.amount, at: t.at });
      }
    }
    const bets: AdminBetRow[] = Array.from(this.bets.values()).map((sb) => ({
      userId: sb.ownerUserId,
      stake: sb.bet.stake,
      potentialReturn: sb.bet.potentialReturn,
      status: sb.bet.status,
      kind: sb.bet.kind ?? "single",
      placedAt: sb.bet.placedAt,
      settledAt: sb.bet.settledAt,
      cashoutValue: sb.bet.cashoutValue,
    }));
    return { users, transactions, bets, affiliateConfig: this.affiliateConfig, generatedAt: Date.now() };
  }

  /** Crédito/débito manual de saldo (admin). Registra no extrato do cliente. */
  adminAdjustBalance(userId: string, amount: number, reason?: string): { ok: boolean; error?: string } {
    const user = this.users.get(userId);
    if (!user) return { ok: false, error: "Cliente não encontrado." };
    const v = round2(amount);
    if (!Number.isFinite(v) || v === 0) return { ok: false, error: "Informe um valor diferente de zero." };
    if (user.wallet.balance + v < 0) return { ok: false, error: "O saldo não pode ficar negativo." };
    user.wallet.balance = round2(user.wallet.balance + v);
    this.addTxn(user, "adjust", v, "completed", reason?.trim() || "Ajuste manual (admin)");
    this.saveUsers();
    return { ok: true };
  }

  /** Bloqueia/desbloqueia um cliente (não permite bloquear admin). */
  adminSetBlocked(userId: string, blocked: boolean): { ok: boolean; error?: string } {
    const user = this.users.get(userId);
    if (!user) return { ok: false, error: "Cliente não encontrado." };
    if (user.role === "admin") return { ok: false, error: "Não é possível bloquear um administrador." };
    user.blocked = blocked;
    this.saveUsers();
    return { ok: true };
  }

  /* ---------------- afiliados ---------------- */

  getAffiliateConfig(): AffiliateConfig {
    return this.affiliateConfig;
  }

  setAffiliateRate(pct: number): { ok: boolean; error?: string } {
    if (!Number.isFinite(pct) || pct < 0 || pct > 1) {
      return { ok: false, error: "A taxa deve estar entre 0% e 100%." };
    }
    this.affiliateConfig = { revSharePct: Math.round(pct * 100) / 100 };
    saveJson("affiliate.json", this.affiliateConfig);
    return { ok: true };
  }

  /** GGR gerado por um usuário (lucro da casa): apostado − pago. */
  private userGgr(userId: string): number {
    let apostado = 0;
    let pago = 0;
    for (const sb of this.bets.values()) {
      if (sb.ownerUserId !== userId) continue;
      const b = sb.bet;
      apostado += b.stake;
      if (b.status === "won") pago += b.potentialReturn;
      else if (b.status === "cashed_out") pago += b.cashoutValue ?? 0;
    }
    return round2(apostado - pago);
  }

  /** Resumo do programa de afiliados para um usuário (indicados, GGR, comissão). */
  getAffiliateSummary(userId: string): AffiliateSummary {
    const me = this.users.get(userId);
    const pct = this.affiliateConfig.revSharePct;
    const refs = Array.from(this.users.values()).filter((u) => u.referredBy === userId);
    let totalGgr = 0;
    let depositors = 0;
    const referrals: AffiliateReferral[] = refs
      .map((u) => {
        const deposited = u.transactions.filter((t) => t.type === "deposit").reduce((s, t) => s + t.amount, 0);
        if (deposited > 0) depositors++;
        const ggr = this.userGgr(u.id);
        totalGgr += ggr;
        return { login: u.login, name: u.name, createdAt: u.createdAt, deposited: round2(deposited), ggr };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
    return {
      code: me?.affiliateCode ?? "",
      revSharePct: pct,
      totalReferrals: refs.length,
      depositors,
      totalGgr: round2(totalGgr),
      commission: round2(Math.max(0, totalGgr) * pct),
      referrals,
    };
  }

  /* ---------------- banners / promoções ---------------- */

  getBranding(): Branding {
    return this.branding;
  }

  saveBranding(b: Branding): Branding {
    this.branding = {
      brandName: (b.brandName ?? "").trim() || TENANT_NAME,
      logoDataUrl: b.logoDataUrl || undefined,
    };
    saveJson("branding.json", this.branding);
    return this.branding;
  }

  getBanners(): Banner[] {
    return [...this.banners].sort((a, b) => a.order - b.order);
  }

  getPromotions(): Promotion[] {
    return [...this.promotions].sort((a, b) => b.createdAt - a.createdAt);
  }

  saveBanner(input: BannerInput): Banner {
    if (input.id) {
      const idx = this.banners.findIndex((b) => b.id === input.id);
      if (idx >= 0) {
        this.banners[idx] = { ...this.banners[idx], ...input, id: input.id };
        saveJson("banners.json", this.banners);
        return this.banners[idx];
      }
    }
    const banner: Banner = { ...input, id: newId("bnr") };
    this.banners.push(banner);
    saveJson("banners.json", this.banners);
    return banner;
  }

  deleteBanner(id: string): void {
    this.banners = this.banners.filter((b) => b.id !== id);
    saveJson("banners.json", this.banners);
  }

  savePromotion(input: PromotionInput): Promotion {
    if (input.id) {
      const idx = this.promotions.findIndex((p) => p.id === input.id);
      if (idx >= 0) {
        this.promotions[idx] = { ...this.promotions[idx], ...input, id: input.id };
        saveJson("promotions.json", this.promotions);
        return this.promotions[idx];
      }
    }
    const promo: Promotion = { ...input, id: newId("promo"), createdAt: Date.now() };
    this.promotions.push(promo);
    saveJson("promotions.json", this.promotions);
    return promo;
  }

  deletePromotion(id: string): void {
    this.promotions = this.promotions.filter((p) => p.id !== id);
    saveJson("promotions.json", this.promotions);
  }
}
