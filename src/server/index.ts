/**
 * Gateway WebSocket — ponto de entrada do servidor de tempo real.
 *
 * Orquestra o motor de simulação (odds), o ledger/contas e o conteúdo
 * configurável (banners/promoções). Um único canal WebSocket entrega: snapshot
 * inicial, odds ao vivo, autenticação, apostas, cashout, liquidação e as ações
 * de backoffice (admin).
 */

import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type {
  ClientMessage,
  ServerMessage,
  Match,
  MultiBetPayload,
  SnapshotPayload,
} from "../shared/types";
import { CASHOUT_MARGIN, MAX_ODDS_DRIFT, TENANT_ID } from "../shared/types";
import { SimulationEngine } from "./engine";
import { DemoEngine } from "./demoEngine";
import { LiveEngine } from "./liveEngine";
import { RealFeedEngine, type OddsSource } from "./realFeed";
import { fetchOddsApiMatches, fetchEventMarkets } from "./providers/theOddsApi";
import { fetchApiFootballMatches } from "./providers/apiFootball";
import { RateLimiter } from "./auth";
import { Store } from "./store";

// O servidor tsx não carrega .env.local sozinho (ao contrário do Next).
try {
  process.loadEnvFile(".env.local");
} catch {
  /* ausente — ok */
}

const PORT = Number(process.env.WS_PORT ?? 4000);
const PROVIDER = process.env.ODDS_PROVIDER ?? "simulation";
const ODDS_KEY = process.env.ODDS_API_KEY ?? "";
const AF_KEY = process.env.APIFOOTBALL_KEY ?? "";

// Origens autorizadas a abrir o WebSocket. Sem isso, qualquer página de
// terceiros poderia abrir uma conexão usando o cookie/token da vítima
// (cross-site WebSocket hijacking). Configurável via WS_ALLOWED_ORIGINS
// (lista separada por vírgula); default cobre o dev local.
const ALLOWED_ORIGINS = new Set(
  (process.env.WS_ALLOWED_ORIGINS ??
    "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
);

/** Aceita a conexão? Origem na allowlist, ou ausente (cliente não-browser). */
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // ferramentas/health-check sem Origin (não é browser)
  return ALLOWED_ORIGINS.has(origin);
}

function makeEngine(): OddsSource {
  // Modo AO VIVO REAL: acervo como pré-jogo + polling de /fixtures?live=all
  // (placar/minuto reais dos jogos acontecendo agora). Precisa da chave AF.
  if (PROVIDER === "live" && AF_KEY) {
    return new LiveEngine(AF_KEY);
  }
  // Modo demonstração: jogos reais (cache) com "ao vivo" simulado por cima.
  if (PROVIDER === "demo") {
    return new DemoEngine();
  }
  if (PROVIDER === "apifootball" && AF_KEY) {
    return new RealFeedEngine(() => fetchApiFootballMatches(AF_KEY));
  }
  if (PROVIDER === "theoddsapi" && ODDS_KEY) {
    return new RealFeedEngine(
      () => fetchOddsApiMatches(ODDS_KEY),
      (m) => fetchEventMarkets(ODDS_KEY, m.providerSportKey ?? "", m.id),
    );
  }
  return new SimulationEngine();
}

const engine: OddsSource = makeEngine();
const store = new Store();

const socketUser = new Map<WebSocket, string | null>();
const socketToken = new Map<WebSocket, string | null>();
const socketIp = new Map<WebSocket, string>();
const userSockets = new Map<string, Set<WebSocket>>();
const alive = new WeakMap<WebSocket, boolean>();

// Proteção contra brute-force / flood.
const loginLimiter = new RateLimiter(8, 15 * 60 * 1000); // 8 tentativas / 15 min, por login
const registerLimiter = new RateLimiter(5, 60 * 60 * 1000); // 5 cadastros / hora, por IP

// Janela de validação anti-fraude para apostas AO VIVO: a aposta só é confirmada
// após este atraso (re-checando odds/suspensão), como nas casas reais.
const LIVE_BET_DELAY_MS = Number(process.env.LIVE_BET_DELAY_MS) || 10000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(msg: ServerMessage): void {
  const data = JSON.stringify(msg);
  for (const ws of wss.clients) if (ws.readyState === WebSocket.OPEN) ws.send(data);
}

function sendToUser(userId: string, msg: ServerMessage): void {
  const set = userSockets.get(userId);
  if (!set) return;
  for (const ws of set) send(ws, msg);
}

function bind(ws: WebSocket, userId: string | null, token: string | null): void {
  const old = socketUser.get(ws);
  if (old) userSockets.get(old)?.delete(ws);
  socketUser.set(ws, userId);
  socketToken.set(ws, token);
  if (userId) {
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId)!.add(ws);
  }
}

function buildSnapshot(userId: string | null): SnapshotPayload {
  const user = userId ? store.getUserPublic(userId) : null;
  return {
    tenantId: TENANT_ID,
    user,
    matches: engine.getMatches(),
    bets: userId ? store.getBets(userId) : [],
    banners: store.getBanners(),
    promotions: store.getPromotions(),
    popularMultiples: store.getPopularMultiples(),
    branding: store.getBranding(),
    transactions: userId ? store.getTransactions(userId) : [],
    serverTime: Date.now(),
  };
}

/** Envia carteira + extrato atualizados ao usuário. */
function pushAccount(userId: string): void {
  const wallet = store.getWallet(userId);
  if (wallet) sendToUser(userId, { type: "wallet", payload: wallet });
  sendToUser(userId, { type: "transactions", payload: store.getTransactions(userId) });
}

/* ------------------------------------------------------------------ */

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, matches: engine.getMatches().length }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer });

// A lib `ws` re-emite erros do httpServer (ex.: EADDRINUSE) na instância do wss;
// sem este handler o processo cairia. O religamento da porta fica no
// httpServer.on("error") (retry) mais abaixo.
wss.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code !== "EADDRINUSE") console.error("[ws] WebSocketServer:", err.message);
});

wss.on("connection", (ws, req) => {
  // Defesa contra cross-site WebSocket hijacking: recusa origens não autorizadas.
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) {
    console.warn(`[ws] conexão recusada — origem não autorizada: ${origin}`);
    ws.close(1008, "Origin não autorizada");
    return;
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  const token = url.searchParams.get("token");
  socketIp.set(ws, req.socket.remoteAddress ?? "?");
  const user = store.userByToken(token);
  bind(ws, user?.id ?? null, user ? token : null);
  alive.set(ws, true);

  send(ws, { type: "snapshot", payload: buildSnapshot(user?.id ?? null) });

  ws.on("pong", () => alive.set(ws, true));
  ws.on("message", (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    handleMessage(ws, msg);
  });
  ws.on("close", () => {
    const uid = socketUser.get(ws);
    if (uid) userSockets.get(uid)?.delete(ws);
    socketUser.delete(ws);
    socketToken.delete(ws);
    socketIp.delete(ws);
  });
});

function handleMessage(ws: WebSocket, msg: ClientMessage): void {
  switch (msg.type) {
    case "ping":
      return;
    case "register":
      return handleRegister(ws, msg.refId, msg.payload);
    case "login":
      return handleLogin(ws, msg.refId, msg.payload);
    case "logout":
      return handleLogout(ws);
    case "deposit":
      return handleWallet(ws, msg.refId, "deposit", msg.payload.amount);
    case "withdraw":
      return handleWallet(ws, msg.refId, "withdraw", msg.payload.amount);
    case "place_bet":
      void handlePlaceBet(ws, msg.refId, msg.payload);
      return;
    case "place_multi":
      void handlePlaceMulti(ws, msg.refId, msg.payload);
      return;
    case "load_markets":
      return handleLoadMarkets(ws, msg.refId, msg.payload.matchId);
    case "cashout":
      return handleCashout(ws, msg.refId, msg.payload.betId);
    case "admin_save_banner":
      return handleAdmin(ws, msg.refId, () => {
        store.saveBanner(msg.payload);
        broadcast({ type: "banners", payload: store.getBanners() });
      });
    case "admin_delete_banner":
      return handleAdmin(ws, msg.refId, () => {
        store.deleteBanner(msg.payload.id);
        broadcast({ type: "banners", payload: store.getBanners() });
      });
    case "admin_save_promo":
      return handleAdmin(ws, msg.refId, () => {
        store.savePromotion(msg.payload);
        broadcast({ type: "promotions", payload: store.getPromotions() });
      });
    case "admin_delete_promo":
      return handleAdmin(ws, msg.refId, () => {
        store.deletePromotion(msg.payload.id);
        broadcast({ type: "promotions", payload: store.getPromotions() });
      });
    case "admin_save_branding":
      return handleAdmin(ws, msg.refId, () => {
        store.saveBranding(msg.payload);
        broadcast({ type: "branding", payload: store.getBranding() });
      });
    case "admin_save_multiple":
      return handleAdmin(ws, msg.refId, () => {
        store.savePopularMultiple(msg.payload);
        broadcast({ type: "popular_multiples", payload: store.getPopularMultiples() });
      });
    case "admin_delete_multiple":
      return handleAdmin(ws, msg.refId, () => {
        store.deletePopularMultiple(msg.payload.id);
        broadcast({ type: "popular_multiples", payload: store.getPopularMultiples() });
      });
    case "admin_overview":
      return handleAdminOverview(ws, msg.refId);
    case "admin_adjust_balance":
      return handleAdminAdjust(ws, msg.refId, msg.payload);
    case "admin_set_blocked":
      return handleAdminSetBlocked(ws, msg.refId, msg.payload);
    case "admin_set_affiliate_rate":
      return handleAdminSetAffiliateRate(ws, msg.refId, msg.payload);
    case "affiliate_summary":
      return handleAffiliateSummary(ws, msg.refId);
    case "check_availability":
      return send(ws, {
        type: "ack",
        payload: { refId: msg.refId, ok: true, data: store.checkAvailability(msg.payload) },
      });
  }
}

/* ---------------- auth ---------------- */

function handleRegister(
  ws: WebSocket,
  refId: string,
  payload: { login: string; password: string; name: string; email: string; phone: string; cpf: string; birthDate: string; ref?: string },
): void {
  const ip = socketIp.get(ws) ?? "?";
  if (!registerLimiter.check(ip)) {
    const mins = Math.max(1, Math.ceil(registerLimiter.retryAfterMs(ip) / 60000));
    return send(ws, { type: "ack", payload: { refId, ok: false, message: `Muitos cadastros recentes. Tente em ~${mins} min.` } });
  }
  const res = store.register(payload);
  if (!res.ok) return send(ws, { type: "ack", payload: { refId, ok: false, message: res.error } });
  bind(ws, res.user.id, res.token);
  send(ws, { type: "snapshot", payload: buildSnapshot(res.user.id) });
  send(ws, { type: "ack", payload: { refId, ok: true, token: res.token, message: "Conta criada!" } });
}

function handleLogin(
  ws: WebSocket,
  refId: string,
  payload: { login: string; password: string },
): void {
  const key = (payload.login ?? "").trim().toLowerCase() || socketIp.get(ws) || "?";
  if (!loginLimiter.check(key)) {
    const mins = Math.max(1, Math.ceil(loginLimiter.retryAfterMs(key) / 60000));
    return send(ws, { type: "ack", payload: { refId, ok: false, message: `Muitas tentativas. Tente novamente em ~${mins} min.` } });
  }
  const res = store.login(payload.login, payload.password);
  if (!res.ok) return send(ws, { type: "ack", payload: { refId, ok: false, message: res.error } });
  loginLimiter.reset(key);
  bind(ws, res.user.id, res.token);
  send(ws, { type: "snapshot", payload: buildSnapshot(res.user.id) });
  send(ws, { type: "ack", payload: { refId, ok: true, token: res.token } });
}

function handleLogout(ws: WebSocket): void {
  const token = socketToken.get(ws);
  if (token) store.logout(token);
  bind(ws, null, null);
  send(ws, { type: "snapshot", payload: buildSnapshot(null) });
}

function handleAdmin(ws: WebSocket, refId: string, action: () => void): void {
  if (!isAdmin(ws)) {
    return send(ws, { type: "ack", payload: { refId, ok: false, message: "Acesso restrito ao administrador." } });
  }
  action();
  send(ws, { type: "ack", payload: { refId, ok: true } });
}

function isAdmin(ws: WebSocket): boolean {
  const uid = socketUser.get(ws);
  const user = uid ? store.getUserPublic(uid) : null;
  return user?.role === "admin";
}

function denyAdmin(ws: WebSocket, refId: string): void {
  send(ws, { type: "ack", payload: { refId, ok: false, message: "Acesso restrito ao administrador." } });
}

function handleAdminOverview(ws: WebSocket, refId: string): void {
  if (!isAdmin(ws)) return denyAdmin(ws, refId);
  send(ws, { type: "ack", payload: { refId, ok: true, data: store.getAdminOverview() } });
}

function handleAdminAdjust(
  ws: WebSocket,
  refId: string,
  payload: { userId: string; amount: number; reason?: string },
): void {
  if (!isAdmin(ws)) return denyAdmin(ws, refId);
  const res = store.adminAdjustBalance(payload.userId, payload.amount, payload.reason);
  if (!res.ok) return send(ws, { type: "ack", payload: { refId, ok: false, message: res.error } });
  pushAccount(payload.userId); // reflete no cliente afetado, se conectado
  send(ws, { type: "ack", payload: { refId, ok: true, data: store.getAdminOverview() } });
}

function handleAdminSetBlocked(
  ws: WebSocket,
  refId: string,
  payload: { userId: string; blocked: boolean },
): void {
  if (!isAdmin(ws)) return denyAdmin(ws, refId);
  const res = store.adminSetBlocked(payload.userId, payload.blocked);
  if (!res.ok) return send(ws, { type: "ack", payload: { refId, ok: false, message: res.error } });
  send(ws, { type: "ack", payload: { refId, ok: true, data: store.getAdminOverview() } });
}

function handleAdminSetAffiliateRate(ws: WebSocket, refId: string, payload: { revSharePct: number }): void {
  if (!isAdmin(ws)) return denyAdmin(ws, refId);
  const res = store.setAffiliateRate(payload.revSharePct);
  if (!res.ok) return send(ws, { type: "ack", payload: { refId, ok: false, message: res.error } });
  send(ws, { type: "ack", payload: { refId, ok: true, data: store.getAdminOverview() } });
}

function handleAffiliateSummary(ws: WebSocket, refId: string): void {
  const uid = socketUser.get(ws);
  if (!uid) return send(ws, { type: "ack", payload: { refId, ok: false, message: "Faça login para ver seus indicados." } });
  send(ws, { type: "ack", payload: { refId, ok: true, data: store.getAffiliateSummary(uid) } });
}

/* ---------------- carteira (depósito / saque) ---------------- */

function handleWallet(ws: WebSocket, refId: string, kind: "deposit" | "withdraw", amount: number): void {
  const userId = socketUser.get(ws);
  if (!userId) {
    return send(ws, { type: "ack", payload: { refId, ok: false, message: "Faça login para movimentar a carteira." } });
  }
  const res = kind === "deposit" ? store.deposit(userId, amount) : store.withdraw(userId, amount);
  if (!res.ok) {
    return send(ws, { type: "ack", payload: { refId, ok: false, message: res.error } });
  }
  pushAccount(userId);
  const message = kind === "deposit" ? "Depósito confirmado (demo)." : "Saque solicitado — em processamento (demo).";
  send(ws, { type: "ack", payload: { refId, ok: true, message } });
}

/* ---------------- apostas ---------------- */

/** Valida uma seleção (encerrada/suspensa/desvio de odd). Retorna msg de erro ou null. */
function validateSelection(
  ws: WebSocket,
  refId: string,
  found: NonNullable<ReturnType<typeof engine.getSelection>>,
  expectedOdds: number,
): string | null {
  if (found.match.status === "finished") return "Partida encerrada.";
  if (found.selection.suspended) return "Mercado suspenso. Tente novamente.";
  const drift = Math.abs(found.selection.odds - expectedOdds) / expectedOdds;
  if (expectedOdds > 0 && drift > MAX_ODDS_DRIFT) {
    send(ws, { type: "match_update", payload: found.match });
    return `A odd mudou para ${found.selection.odds.toFixed(2)}. Confira e tente de novo.`;
  }
  return null;
}

async function handlePlaceBet(
  ws: WebSocket,
  refId: string,
  payload: { matchId: string; marketKey: string; selectionId: string; stake: number; expectedOdds: number },
): Promise<void> {
  const userId = socketUser.get(ws);
  if (!userId) {
    return send(ws, { type: "ack", payload: { refId, ok: false, message: "Faça login para apostar." } });
  }

  let found = engine.getSelection(payload.matchId, payload.marketKey, payload.selectionId);
  if (!found) return send(ws, { type: "ack", payload: { refId, ok: false, message: "Mercado indisponível." } });

  let err = validateSelection(ws, refId, found, payload.expectedOdds);
  if (err) return send(ws, { type: "ack", payload: { refId, ok: false, message: err } });

  // AO VIVO: janela de validação anti-fraude (~10s). Re-checa odds/suspensão.
  if (found.match.status === "live") {
    await sleep(LIVE_BET_DELAY_MS);
    found = engine.getSelection(payload.matchId, payload.marketKey, payload.selectionId);
    if (!found) return send(ws, { type: "ack", payload: { refId, ok: false, message: "Mercado indisponível agora." } });
    err = validateSelection(ws, refId, found, payload.expectedOdds);
    if (err) return send(ws, { type: "ack", payload: { refId, ok: false, message: err } });
  }

  const { match, market, selection } = found;
  const result = store.placeBet(userId, {
    matchId: match.id,
    matchLabel: `${match.home} x ${match.away}`,
    league: match.league,
    marketKey: market.key,
    marketName: market.name,
    selectionId: selection.id,
    selectionLabel: selection.label,
    oddsLocked: selection.odds,
    stake: payload.stake,
  });

  if (!result.ok || !result.bet) {
    return send(ws, { type: "ack", payload: { refId, ok: false, message: result.error ?? "Falha ao apostar." } });
  }

  send(ws, { type: "ack", payload: { refId, ok: true, bet: result.bet } });
  sendToUser(userId, { type: "bet_update", payload: result.bet });
  pushAccount(userId);
}

function handleLoadMarkets(ws: WebSocket, refId: string, matchId: string): void {
  const p = engine.loadMarkets ? engine.loadMarkets(matchId) : undefined;
  Promise.resolve(p)
    .then(() => send(ws, { type: "ack", payload: { refId, ok: true } }))
    .catch(() => send(ws, { type: "ack", payload: { refId, ok: false, message: "Falha ao carregar mercados." } }));
}

async function handlePlaceMulti(ws: WebSocket, refId: string, payload: MultiBetPayload): Promise<void> {
  const userId = socketUser.get(ws);
  if (!userId) {
    return send(ws, { type: "ack", payload: { refId, ok: false, message: "Faça login para apostar." } });
  }
  const sels = payload.selections ?? [];
  if (sels.length < 2) {
    return send(ws, { type: "ack", payload: { refId, ok: false, message: "A múltipla precisa de ao menos 2 seleções." } });
  }

  type Built = { error: string } | { legs: Parameters<typeof store.placeMulti>[1]; anyLive: boolean };
  const build = (): Built => {
    const legs: Parameters<typeof store.placeMulti>[1] = [];
    const seen = new Set<string>();
    let anyLive = false;
    for (const sel of sels) {
      const found = engine.getSelection(sel.matchId, sel.marketKey, sel.selectionId);
      if (!found) return { error: "Uma seleção ficou indisponível." };
      if (found.match.status === "finished") return { error: "Uma das partidas já encerrou." };
      if (found.selection.suspended) return { error: "Um mercado está suspenso." };
      if (seen.has(sel.matchId)) return { error: "Não dá para combinar seleções do mesmo jogo." };
      seen.add(sel.matchId);
      if (found.match.status === "live") anyLive = true;
      const drift = Math.abs(found.selection.odds - sel.expectedOdds) / sel.expectedOdds;
      if (sel.expectedOdds > 0 && drift > MAX_ODDS_DRIFT) {
        send(ws, { type: "match_update", payload: found.match });
        return { error: "Uma odd mudou. Confira o bilhete." };
      }
      legs.push({
        matchId: found.match.id,
        matchLabel: `${found.match.home} x ${found.match.away}`,
        league: found.match.league,
        marketName: found.market.name,
        selectionId: found.selection.id,
        selectionLabel: found.selection.label,
        oddsLocked: found.selection.odds,
      });
    }
    return { legs, anyLive };
  };

  let r = build();
  if ("error" in r) return send(ws, { type: "ack", payload: { refId, ok: false, message: r.error } });

  // AO VIVO: janela anti-fraude (~10s) se alguma perna estiver ao vivo; re-valida.
  if (r.anyLive) {
    await sleep(LIVE_BET_DELAY_MS);
    r = build();
    if ("error" in r) return send(ws, { type: "ack", payload: { refId, ok: false, message: r.error } });
  }

  const result = store.placeMulti(userId, r.legs, payload.stake);
  if (!result.ok || !result.bet) {
    return send(ws, { type: "ack", payload: { refId, ok: false, message: result.error ?? "Falha ao apostar." } });
  }
  send(ws, { type: "ack", payload: { refId, ok: true, bet: result.bet } });
  sendToUser(userId, { type: "bet_update", payload: result.bet });
  pushAccount(userId);
}

function handleCashout(ws: WebSocket, refId: string, betId: string): void {
  const userId = socketUser.get(ws);
  if (!userId) {
    return send(ws, { type: "ack", payload: { refId, ok: false, message: "Faça login para fazer cashout." } });
  }

  const bet = store.getBet(userId, betId);
  if (!bet) return send(ws, { type: "ack", payload: { refId, ok: false, message: "Aposta não encontrada." } });
  if (bet.status !== "open") {
    return send(ws, { type: "ack", payload: { refId, ok: false, message: "Aposta não está mais aberta." } });
  }

  const found = engine.getSelection(bet.matchId, bet.marketKey, bet.selectionId);
  if (!found || found.match.status === "finished") {
    return send(ws, { type: "ack", payload: { refId, ok: false, message: "Cashout indisponível agora." } });
  }
  if (found.selection.suspended) {
    return send(ws, { type: "ack", payload: { refId, ok: false, message: "Mercado suspenso. Tente em instantes." } });
  }

  const raw = bet.stake * (bet.oddsLocked / found.selection.odds) * (1 - CASHOUT_MARGIN);
  const value = round2(Math.max(0, raw));

  const result = store.creditCashout(userId, betId, value);
  if (!result.ok || !result.bet) {
    return send(ws, { type: "ack", payload: { refId, ok: false, message: result.error ?? "Falha no cashout." } });
  }

  send(ws, { type: "ack", payload: { refId, ok: true, bet: result.bet } });
  sendToUser(userId, { type: "bet_update", payload: result.bet });
  pushAccount(userId);
}

/* ---------------- eventos do motor ---------------- */

// Coalescência: o motor emite muitos `match_update` por tick (um por jogo ao
// vivo). Em vez de transmitir cada um (o que faria o cliente recompor o board
// dezenas de vezes por segundo), acumulamos e enviamos UM `matches_batch` por
// janela — o cliente aplica tudo num único render. Mantém o board fluido mesmo
// com dezenas de jogos ao vivo.
const pendingUpdates = new Map<string, Match>();
engine.on("match_update", (match: Match) => {
  pendingUpdates.set(match.id, match);
});
const flushUpdates = setInterval(() => {
  if (pendingUpdates.size === 0) return;
  const batch = Array.from(pendingUpdates.values());
  pendingUpdates.clear();
  broadcast({ type: "matches_batch", payload: batch });
}, 1000);

engine.on("match_removed", (matchId: string) => {
  pendingUpdates.delete(matchId);
  broadcast({ type: "match_removed", payload: { matchId } });
});
engine.on("match_finished", (match: Match) => {
  const results = store.settleMatch(match.id, match.score);
  const affected = new Set<string>();
  for (const r of results) {
    sendToUser(r.userId, { type: "bet_update", payload: r.bet });
    if (r.bet.status === "won" || r.bet.status === "lost") {
      const verb = r.bet.status === "won" ? "Ganhou" : "Perdeu";
      const label = r.bet.kind === "multi" ? "Múltipla" : `${r.bet.selectionLabel} (${r.bet.matchLabel})`;
      sendToUser(r.userId, { type: "bet_result", payload: { bet: r.bet, message: `${verb}: ${label}` } });
    }
    affected.add(r.userId);
  }
  for (const uid of affected) pushAccount(uid);
});

/* ---------------- heartbeat ---------------- */

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (alive.get(ws) === false) {
      ws.terminate();
      continue;
    }
    alive.set(ws, false);
    ws.ping();
  }
}, 30000);
wss.on("close", () => clearInterval(heartbeat));

engine.start();

// Sobe o gateway. No Windows, o `tsx watch` às vezes inicia o novo processo
// antes de o anterior liberar a :4000 — então re-tentamos brevemente em vez de
// estourar EADDRINUSE e derrubar o servidor.
const MAX_LISTEN_RETRIES = 30;
let listenRetries = 0;
httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE" && listenRetries < MAX_LISTEN_RETRIES) {
    listenRetries++;
    setTimeout(() => httpServer.listen(PORT), 300);
  } else {
    console.error("[ws] não foi possível subir o gateway:", err.message);
    process.exit(1);
  }
});
httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[ws] gateway BrasilBet (fonte: ${PROVIDER}) em http://localhost:${PORT}`);
});

// Encerramento limpo: libera a porta rápido nos restarts do dev (tsx watch) e no Ctrl-C.
function shutdown(): void {
  try {
    engine.stop();
    clearInterval(heartbeat);
    clearInterval(flushUpdates);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
    httpServer.close(() => process.exit(0));
  } catch {
    /* ignore */
  }
  setTimeout(() => process.exit(0), 800).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
