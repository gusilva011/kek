"use client";

/**
 * Cliente WebSocket do browser. Mantém a conexão com o gateway, reconecta
 * automaticamente, persiste o token de sessão e oferece request/response (via
 * refId) para autenticação, apostas, cashout e ações de backoffice.
 */

import { useStore } from "@/store/useStore";
import type {
  AckPayload,
  AvailabilityResult,
  BannerInput,
  Branding,
  ClientMessage,
  MultiBetPayload,
  PlaceBetPayload,
  PopularMultipleInput,
  PromotionInput,
  ServerMessage,
} from "@/shared/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000";
const TOKEN_KEY = "brasilbet_token";
const REF_KEY = "brasilbet_ref";

let socket: WebSocket | null = null;
let reconnectAttempts = 0;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let intentionalClose = false;
let refSeq = 0;

const pending = new Map<string, { resolve: (a: AckPayload) => void; timer: ReturnType<typeof setTimeout> }>();

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}
function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Captura ?ref= da URL (link de indicação de afiliado) e guarda até o cadastro. */
function captureRef(): void {
  try {
    const ref = new URL(window.location.href).searchParams.get("ref");
    if (ref) localStorage.setItem(REF_KEY, ref.trim().toUpperCase());
  } catch {
    /* ignore */
  }
}
function getRef(): string | null {
  try {
    return localStorage.getItem(REF_KEY);
  } catch {
    return null;
  }
}
function clearRef(): void {
  try {
    localStorage.removeItem(REF_KEY);
  } catch {
    /* ignore */
  }
}

/** Lê o código de indicação pendente (para a UI mostrar "indicado por …"). */
export function pendingRef(): string | null {
  return getRef();
}

export function connect(): void {
  if (typeof window === "undefined") return;

  // Guarda a conexão no `window` para sobreviver ao Hot Reload do dev: sem isso,
  // cada recarga de módulo cria um socket novo e VAZA o anterior (cada socket
  // vazado segue recebendo a enxurrada de updates e trava a aba). Em produção
  // não há HMR, mas a proteção é inofensiva.
  const w = window as unknown as { __betWs?: WebSocket };
  const existing = w.__betWs;
  if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
    socket = existing; // reusa o socket vivo
    return;
  }
  if (existing) {
    try {
      existing.close();
    } catch {
      /* ignore */
    }
  }
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  captureRef();
  useStore.getState().setConn("connecting");
  const token = getToken();
  const url = token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL;
  socket = new WebSocket(url);
  w.__betWs = socket;

  socket.onopen = () => {
    reconnectAttempts = 0;
    useStore.getState().setConn("open");
    startPing();
  };
  socket.onmessage = (ev) => {
    try {
      handle(JSON.parse(ev.data) as ServerMessage);
    } catch {
      /* ignore */
    }
  };
  socket.onclose = () => {
    useStore.getState().setConn("closed");
    stopPing();
    if (!intentionalClose) scheduleReconnect();
  };
  socket.onerror = () => {};
}

function scheduleReconnect(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectAttempts++;
  const delay = Math.min(10000, 500 * 2 ** reconnectAttempts);
  reconnectTimer = setTimeout(connect, delay);
}

function startPing(): void {
  stopPing();
  pingTimer = setInterval(() => send({ type: "ping" }), 25000);
}
function stopPing(): void {
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = null;
}

function send(msg: ClientMessage): void {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

function handle(msg: ServerMessage): void {
  const s = useStore.getState();
  switch (msg.type) {
    case "snapshot":
      s.applySnapshot(msg.payload);
      break;
    case "match_update":
      s.upsertMatch(msg.payload);
      break;
    case "matches_batch":
      s.upsertMatches(msg.payload);
      break;
    case "match_removed":
      s.removeMatch(msg.payload.matchId);
      break;
    case "wallet":
      s.setWallet(msg.payload);
      break;
    case "bet_update":
      s.upsertBet(msg.payload);
      break;
    case "bet_result":
      s.upsertBet(msg.payload.bet);
      s.pushToast({
        kind: msg.payload.bet.status === "won" ? "success" : "info",
        message: msg.payload.message,
      });
      break;
    case "banners":
      s.setBanners(msg.payload);
      break;
    case "promotions":
      s.setPromotions(msg.payload);
      break;
    case "popular_multiples":
      s.setPopularMultiples(msg.payload);
      break;
    case "branding":
      s.setBranding(msg.payload);
      break;
    case "transactions":
      s.setTransactions(msg.payload);
      break;
    case "ack":
      resolveAck(msg.payload);
      break;
    case "error":
      s.pushToast({ kind: "error", message: msg.payload.message });
      break;
  }
}

function resolveAck(ack: AckPayload): void {
  const p = pending.get(ack.refId);
  if (p) {
    clearTimeout(p.timer);
    pending.delete(ack.refId);
    p.resolve(ack);
  }
}

function request(msg: ClientMessage & { refId: string }, timeoutMs = 8000): Promise<AckPayload> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(msg.refId);
      resolve({ refId: msg.refId, ok: false, message: "Tempo esgotado. Verifique a conexão." });
    }, timeoutMs);
    pending.set(msg.refId, { resolve, timer });
    send(msg);
  });
}

function newRef(): string {
  return `r_${++refSeq}_${Math.random().toString(36).slice(2, 6)}`;
}

/* ---------------- auth ---------------- */

export async function register(input: {
  login: string;
  password: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string;
  /** Código de indicação digitado no formulário (tem prioridade sobre o ?ref= do link). */
  ref?: string;
}): Promise<AckPayload> {
  const ref = input.ref?.trim().toUpperCase() || getRef() || undefined;
  const ack = await request({ type: "register", refId: newRef(), payload: { ...input, ref } });
  if (ack.ok && ack.token) {
    saveToken(ack.token);
    clearRef(); // indicação consumida
  }
  return ack;
}

/** Consulta se login/CPF/e-mail estão disponíveis (checagem em tempo real no cadastro). */
export async function checkAvailability(input: {
  login?: string;
  cpf?: string;
  email?: string;
}): Promise<AvailabilityResult> {
  const ack = await request({ type: "check_availability", refId: newRef(), payload: input });
  return ack.ok && ack.data ? (ack.data as AvailabilityResult) : {};
}

export async function login(loginName: string, password: string): Promise<AckPayload> {
  const ack = await request({ type: "login", refId: newRef(), payload: { login: loginName, password } });
  if (ack.ok && ack.token) saveToken(ack.token);
  return ack;
}

export function logout(): void {
  clearToken();
  useStore.getState().setUser(null);
  send({ type: "logout" });
}

/* ---------------- carteira ---------------- */

export function deposit(amount: number): Promise<AckPayload> {
  return request({ type: "deposit", refId: newRef(), payload: { amount } });
}
export function withdraw(amount: number): Promise<AckPayload> {
  return request({ type: "withdraw", refId: newRef(), payload: { amount } });
}

/* ---------------- apostas ---------------- */

// Timeout maior: apostas ao vivo passam por ~10s de validação anti-fraude no servidor.
export function placeBet(payload: PlaceBetPayload): Promise<AckPayload> {
  return request({ type: "place_bet", refId: newRef(), payload }, 15000);
}
export function placeMulti(payload: MultiBetPayload): Promise<AckPayload> {
  return request({ type: "place_multi", refId: newRef(), payload }, 15000);
}
export function loadMarkets(matchId: string): Promise<AckPayload> {
  return request({ type: "load_markets", refId: newRef(), payload: { matchId } });
}
export function cashout(betId: string): Promise<AckPayload> {
  return request({ type: "cashout", refId: newRef(), payload: { betId } });
}

/* ---------------- backoffice ---------------- */

export function adminSaveBanner(payload: BannerInput): Promise<AckPayload> {
  return request({ type: "admin_save_banner", refId: newRef(), payload });
}
export function adminDeleteBanner(id: string): Promise<AckPayload> {
  return request({ type: "admin_delete_banner", refId: newRef(), payload: { id } });
}
export function adminSavePromo(payload: PromotionInput): Promise<AckPayload> {
  return request({ type: "admin_save_promo", refId: newRef(), payload });
}
export function adminDeletePromo(id: string): Promise<AckPayload> {
  return request({ type: "admin_delete_promo", refId: newRef(), payload: { id } });
}
export function adminSaveBranding(payload: Branding): Promise<AckPayload> {
  return request({ type: "admin_save_branding", refId: newRef(), payload });
}
export function adminSaveMultiple(payload: PopularMultipleInput): Promise<AckPayload> {
  return request({ type: "admin_save_multiple", refId: newRef(), payload });
}
export function adminDeleteMultiple(id: string): Promise<AckPayload> {
  return request({ type: "admin_delete_multiple", refId: newRef(), payload: { id } });
}

/* ---------------- backoffice: CRM / métricas ---------------- */

export function adminOverview(): Promise<AckPayload> {
  return request({ type: "admin_overview", refId: newRef() });
}
export function adminAdjustBalance(userId: string, amount: number, reason?: string): Promise<AckPayload> {
  return request({ type: "admin_adjust_balance", refId: newRef(), payload: { userId, amount, reason } });
}
export function adminSetBlocked(userId: string, blocked: boolean): Promise<AckPayload> {
  return request({ type: "admin_set_blocked", refId: newRef(), payload: { userId, blocked } });
}
export function adminSetAffiliateRate(revSharePct: number): Promise<AckPayload> {
  return request({ type: "admin_set_affiliate_rate", refId: newRef(), payload: { revSharePct } });
}

/* ---------------- afiliados (usuário) ---------------- */

export function affiliateSummary(): Promise<AckPayload> {
  return request({ type: "affiliate_summary", refId: newRef() });
}

export function disconnect(): void {
  intentionalClose = true;
  socket?.close();
}
