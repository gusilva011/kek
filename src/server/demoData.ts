/**
 * Gerador do acervo de DEMONSTRAÇÃO do backoffice/CRM.
 *
 * Cria clientes brasileiros sintéticos com histórico realista (cadastros,
 * depósitos, saques, apostas liquidadas, cashouts) distribuído nos últimos
 * meses, além de uma rede de afiliados com indicados. Serve para que o painel
 * administrativo pareça um operador real e movimentado — a vitrine que vende o
 * sistema — sem depender de uso manual.
 *
 * É carregado SOMENTE em modo demonstração e de forma idempotente (a Store usa
 * um marcador para não semear duas vezes). Toda conta gerada leva `demo: true`,
 * então é trivial distinguir/limpar do que é cliente real.
 *
 * Observação: a "casa" tem margem positiva por construção (odds com ~9% de
 * vig), então o GGR agregado fica coerente com um sportsbook saudável.
 */

import { hashPassword, newId, newAffiliateCode } from "./auth";
import type { Bet, Transaction, TxType } from "../shared/types";
import { CURRENCY, STARTING_BALANCE } from "../shared/types";
import type { StoredBet, StoredUser } from "./store";

const DAY = 86_400_000;

const FIRST_NAMES = [
  "Miguel", "Arthur", "Heitor", "Bernardo", "Davi", "Théo", "Gabriel", "Pedro", "Lucas", "Matheus",
  "Rafael", "Enzo", "Guilherme", "Gustavo", "Felipe", "João", "Bruno", "Vinícius", "Thiago", "Leonardo",
  "Helena", "Alice", "Laura", "Maria", "Sophia", "Manuela", "Júlia", "Isabella", "Luiza", "Beatriz",
  "Mariana", "Letícia", "Camila", "Fernanda", "Carolina", "Amanda", "Larissa", "Patrícia", "Juliana", "Aline",
  "Ricardo", "Eduardo", "Marcelo", "Rodrigo", "André", "Diego", "Caio", "Daniel", "Henrique", "Igor",
];
const LAST_NAMES = [
  "Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento",
  "Carvalho", "Araújo", "Ribeiro", "Gomes", "Martins", "Rocha", "Barbosa", "Alves", "Mendes", "Ferreira",
  "Cardoso", "Teixeira", "Moreira", "Correia", "Cavalcanti", "Dias", "Castro", "Campos", "Freitas", "Pinto",
];
const DDD = ["11", "21", "31", "41", "47", "51", "61", "62", "71", "81", "85", "27", "48", "98", "65"];

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function rnd(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
function rndInt(min: number, max: number): number {
  return Math.floor(rnd(min, max + 1));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function chance(p: number): boolean {
  return Math.random() < p;
}

/** CPF sintético com dígitos verificadores válidos (passa em isValidCpf). */
function genCpf(): string {
  const n: number[] = Array.from({ length: 9 }, () => rndInt(0, 9));
  let s1 = 0;
  for (let i = 0; i < 9; i++) s1 += n[i] * (10 - i);
  let d1 = 11 - (s1 % 11);
  if (d1 >= 10) d1 = 0;
  n.push(d1);
  let s2 = 0;
  for (let i = 0; i < 10; i++) s2 += n[i] * (11 - i);
  let d2 = 11 - (s2 % 11);
  if (d2 >= 10) d2 = 0;
  n.push(d2);
  return n.join("");
}

function genPhone(): string {
  return `${pick(DDD)}9${rndInt(10000000, 99999999)}`;
}

function birthDateForAge(age: number): string {
  const now = new Date();
  const y = now.getFullYear() - age;
  const m = rndInt(1, 12);
  const d = rndInt(1, 28);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const DEPOSIT_AMOUNTS = [30, 50, 50, 100, 100, 100, 200, 200, 300, 500, 500, 1000, 2000];

interface PlayerOpts {
  index: number;
  createdAt: number;
  /** 0 casual, 1 regular, 2 high-roller. */
  tier: number;
  referredBy?: string;
  /** Credenciais compartilhadas (calculadas uma vez para não travar o boot). */
  cred: { salt: string; hash: string };
}

/** Simula a "vida" financeira de um cliente: gera transações + apostas coerentes. */
function buildPlayer(opts: PlayerOpts): { user: StoredUser; bets: StoredBet[] } {
  const { createdAt, tier } = opts;
  const now = Date.now();
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const last2 = pick(LAST_NAMES);
  const name = `${first} ${last} ${last2}`;
  const slug = `${first}.${last}${rndInt(1, 999)}`.toLowerCase();
  const { salt, hash } = opts.cred;

  const txns: Transaction[] = [];
  const bets: StoredBet[] = [];
  let balance = 0;

  const addTxn = (type: TxType, amount: number, at: number, status: Transaction["status"], description: string) => {
    balance = round2(balance + amount);
    txns.push({ id: newId("tx"), type, amount: round2(amount), balanceAfter: balance, status, description, at });
  };

  // Bônus de boas-vindas no cadastro.
  addTxn("bonus", STARTING_BALANCE, createdAt + rndInt(1000, 60000), "completed", "Bônus de boas-vindas");

  // Quantidade de eventos por engajamento.
  const nDeposits = tier === 2 ? rndInt(3, 9) : tier === 1 ? rndInt(1, 5) : rndInt(0, 2);
  const nBets = tier === 2 ? rndInt(20, 70) : tier === 1 ? rndInt(6, 28) : rndInt(0, 8);

  // Linha do tempo de eventos (timestamps espalhados entre o cadastro e agora).
  type Ev = { at: number; kind: "deposit" | "bet" };
  const evs: Ev[] = [];
  for (let i = 0; i < nDeposits; i++) evs.push({ at: rnd(createdAt, now), kind: "deposit" });
  for (let i = 0; i < nBets; i++) evs.push({ at: rnd(createdAt, now), kind: "bet" });
  evs.sort((a, b) => a.at - b.at);

  let betSeq = 0;
  for (const ev of evs) {
    if (ev.kind === "deposit") {
      const amt = pick(DEPOSIT_AMOUNTS) * (tier === 2 ? rndInt(1, 4) : 1);
      addTxn("deposit", amt, ev.at, "completed", "Depósito via Pix");
      continue;
    }

    // Aposta — garante saldo; senão, um depósito oportuno.
    const baseStake = tier === 2 ? rnd(50, 600) : tier === 1 ? rnd(15, 150) : rnd(5, 50);
    let stake = round2(Math.min(baseStake, balance));
    if (stake < 5) {
      const amt = pick(DEPOSIT_AMOUNTS);
      addTxn("deposit", amt, ev.at - 1000, "completed", "Depósito via Pix");
      stake = round2(Math.min(baseStake, balance));
      if (stake < 5) continue;
    }

    const odds = round2(rnd(1.35, 4.8));
    const potential = round2(stake * odds);
    addTxn("bet", -stake, ev.at, "completed", "Aposta esportiva");

    const id = `bd_${opts.index}x${betSeq++}_${newId("").slice(1, 7)}`;
    const settledAt = Math.min(now, ev.at + rndInt(2, 48) * 3_600_000);
    const stillOpen = now - ev.at < 2 * DAY && chance(0.5);

    const bet: Bet = {
      id,
      matchId: "",
      matchLabel: "Evento esportivo",
      league: "",
      marketKey: "1x2",
      marketName: "Resultado Final",
      selectionId: "",
      selectionLabel: "Seleção",
      oddsLocked: odds,
      stake,
      potentialReturn: potential,
      status: "open",
      placedAt: ev.at,
    };

    if (stillOpen) {
      bets.push({ bet, ownerUserId: "" });
      continue;
    }

    // Vig da casa embutido: prob real de vitória ~ 9% abaixo da implícita.
    const winProb = Math.max(0.04, Math.min(0.95, (1 / odds) * 0.91));
    if (chance(0.12)) {
      // Cashout antecipado.
      const value = round2(stake * rnd(0.45, 1.35));
      bet.status = "cashed_out";
      bet.cashoutValue = value;
      bet.settledAt = settledAt;
      addTxn("cashout", value, settledAt, "completed", "Cashout");
    } else if (chance(winProb)) {
      bet.status = "won";
      bet.settledAt = settledAt;
      addTxn("win", potential, settledAt, "completed", "Aposta vencedora");
    } else {
      bet.status = "lost";
      bet.settledAt = settledAt;
    }
    bets.push({ bet, ownerUserId: "" });
  }

  // Saque ocasional quando há saldo confortável.
  if (balance > 400 && chance(tier === 0 ? 0.25 : 0.55)) {
    const amt = round2(Math.min(balance * rnd(0.2, 0.7), balance));
    if (amt >= 20) {
      const at = rnd(createdAt + DAY, now);
      const pending = now - at < DAY && chance(0.4);
      addTxn("withdraw", -amt, at, pending ? "pending" : "completed", "Saque Pix");
    }
  }

  txns.sort((a, b) => b.at - a.at); // extrato: mais recente primeiro
  if (txns.length > 100) txns.length = 100;

  const user: StoredUser = {
    id: newId("usr"),
    login: slug,
    loginLower: slug,
    name,
    email: `${slug}@email.com`,
    phone: genPhone(),
    cpf: genCpf(),
    birthDate: birthDateForAge(rndInt(18, 58)),
    passwordSalt: salt,
    passwordHash: hash,
    role: "user",
    wallet: { balance: round2(Math.max(0, balance)), currency: CURRENCY },
    transactions: txns,
    createdAt,
    blocked: chance(0.03),
    affiliateCode: newAffiliateCode(),
    referredBy: opts.referredBy,
    demo: true,
  };

  // Vincula o dono nas apostas agora que o id existe.
  for (const sb of bets) sb.ownerUserId = user.id;
  return { user, bets };
}

export interface DemoDataset {
  users: StoredUser[];
  bets: StoredBet[];
}

/**
 * Gera o acervo completo de demonstração.
 * @param count número de clientes (default 160).
 */
export function generateDemoDataset(count = 160): DemoDataset {
  const now = Date.now();
  const HORIZON = 285 * DAY; // ~9,5 meses de histórico
  // Senha compartilhada ("demo1234") — hash calculado uma única vez.
  const cred = hashPassword("demo1234");

  const players: { user: StoredUser; bets: StoredBet[] }[] = [];

  for (let i = 0; i < count; i++) {
    // Curva de crescimento: mais cadastros nos meses recentes.
    const daysAgo = Math.floor((HORIZON / DAY) * Math.pow(Math.random(), 1.7));
    const createdAt = now - daysAgo * DAY - rndInt(0, DAY);
    // Mix de engajamento: 58% casual, 30% regular, 12% high-roller.
    const r = Math.random();
    const tier = r < 0.58 ? 0 : r < 0.88 ? 1 : 2;
    players.push(buildPlayer({ index: i, createdAt, tier, cred }));
  }

  // Rede de afiliados: ~14% dos clientes viram afiliados; ~50% dos demais
  // são indicados por um afiliado (alguns concentram mais indicados).
  const affiliateCount = Math.max(6, Math.round(count * 0.14));
  const affiliates = players.slice(0, affiliateCount);
  for (let i = affiliateCount; i < players.length; i++) {
    if (chance(0.5)) {
      // Sorteio enviesado: índices menores (afiliados "veteranos") pegam mais.
      const idx = Math.floor(Math.pow(Math.random(), 1.6) * affiliateCount);
      const aff = affiliates[idx]?.user;
      if (aff && aff.id !== players[i].user.id && players[i].user.createdAt >= aff.createdAt) {
        players[i].user.referredBy = aff.id;
      }
    }
  }

  const users = players.map((p) => p.user);
  const bets = players.flatMap((p) => p.bets);
  return { users, bets };
}
