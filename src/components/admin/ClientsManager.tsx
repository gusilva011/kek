"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminOverview } from "@/shared/types";
import { adminOverview, adminAdjustBalance, adminSetBlocked } from "@/lib/ws";
import { formatMoney, maskCpf, formatPhone } from "@/lib/format";
import { useStore } from "@/store/useStore";
import { Icon } from "../ui/Icon";

function userAgg(d: AdminOverview, userId: string) {
  const txs = d.transactions.filter((t) => t.userId === userId);
  const bets = d.bets.filter((b) => b.userId === userId);
  return {
    depositado: txs.filter((t) => t.type === "deposit").reduce((s, t) => s + t.amount, 0),
    sacado: txs.filter((t) => t.type === "withdraw").reduce((s, t) => s + Math.abs(t.amount), 0),
    apostado: bets.reduce((s, b) => s + b.stake, 0),
    nApostas: bets.length,
    ultima: bets.length ? Math.max(...bets.map((b) => b.placedAt)) : 0,
  };
}

function fmtDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function ClientsManager() {
  const pushToast = useStore((s) => s.pushToast);
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const ack = await adminOverview();
    setLoading(false);
    if (ack.ok && ack.data) setData(ack.data as AdminOverview);
  };

  useEffect(() => {
    load();
  }, []);

  const clientes = useMemo(() => (data?.users ?? []).filter((u) => u.role === "user"), [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? clientes.filter((u) => [u.name, u.login, u.email, u.cpf].some((v) => (v || "").toLowerCase().includes(q)))
      : clientes;
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [clientes, search]);

  const sel = selId && data ? data.users.find((u) => u.id === selId) ?? null : null;
  const selAgg = sel && data ? userAgg(data, sel.id) : null;

  const doAdjust = async (sign: 1 | -1) => {
    if (!sel) return;
    const value = Number(adjAmount.replace(",", ".")) * sign;
    if (!Number.isFinite(value) || value === 0) {
      pushToast({ kind: "error", message: "Informe um valor válido." });
      return;
    }
    setBusy(true);
    const ack = await adminAdjustBalance(sel.id, value, adjReason);
    setBusy(false);
    if (ack.ok) {
      if (ack.data) setData(ack.data as AdminOverview);
      setAdjAmount("");
      setAdjReason("");
      pushToast({ kind: "success", message: `Saldo ajustado (${formatMoney(value)}).` });
    } else {
      pushToast({ kind: "error", message: ack.message ?? "Falha ao ajustar." });
    }
  };

  const doBlock = async () => {
    if (!sel) return;
    setBusy(true);
    const ack = await adminSetBlocked(sel.id, !sel.blocked);
    setBusy(false);
    if (ack.ok) {
      if (ack.data) setData(ack.data as AdminOverview);
      pushToast({ kind: "success", message: sel.blocked ? "Cliente reativado." : "Cliente bloqueado." });
    } else {
      pushToast({ kind: "error", message: ack.message ?? "Falha." });
    }
  };

  /** Exporta os clientes filtrados para CSV (UTF-8 com BOM, separador ; — abre no Excel-BR). */
  const exportCsv = () => {
    if (!data || filtered.length === 0) return;
    const money = (v: number) => v.toFixed(2).replace(".", ",");
    const esc = (s: string | number) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const header = [
      "Nome", "Login", "E-mail", "CPF", "Telefone", "Saldo", "Depositado",
      "Sacado", "Apostado", "Apostas", "Cadastro", "Status",
    ];
    const lines = filtered.map((u) => {
      const a = userAgg(data, u.id);
      return [
        u.name, u.login, u.email, u.cpf, u.phone, money(u.balance), money(a.depositado),
        money(a.sacado), money(a.apostado), a.nApostas, fmtDate(u.createdAt), u.blocked ? "Bloqueado" : "Ativo",
      ];
    });
    const csv = [header, ...lines].map((r) => r.map(esc).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-brasilbet-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    pushToast({ kind: "success", message: `${lines.length} cliente(s) exportado(s) em CSV.` });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <Icon name="search" size={16} />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, login, e-mail ou CPF…"
            className="w-full rounded-lg border border-ink-600 bg-ink-900 py-2 pl-9 pr-3 text-sm text-slate-200 outline-none focus:border-brand"
          />
        </div>
        <button
          onClick={exportCsv}
          disabled={!data || filtered.length === 0}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-ink-800 disabled:opacity-50"
          title="Baixar os clientes filtrados em CSV"
        >
          <Icon name="chart" size={15} /> <span className="hidden sm:inline">Exportar</span> CSV
        </button>
        <button onClick={load} className="rounded-lg border border-ink-600 px-3 py-2 text-sm text-slate-300 hover:bg-ink-800">
          ↻
        </button>
      </div>

      <p className="text-xs text-slate-500">
        {loading ? "Carregando…" : `${filtered.length} cliente(s)`}
      </p>

      <div className="overflow-hidden rounded-xl border border-ink-600">
        <div className="hidden grid-cols-[2fr_1.4fr_1fr_0.8fr_auto] gap-2 border-b border-ink-700 bg-ink-800 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid">
          <span>Cliente</span>
          <span>Contato</span>
          <span className="text-right">Saldo</span>
          <span>Cadastro</span>
          <span></span>
        </div>
        {filtered.map((u) => (
          <button
            key={u.id}
            onClick={() => setSelId(u.id)}
            className="grid w-full grid-cols-2 items-center gap-2 border-b border-ink-700/60 px-4 py-2.5 text-left text-sm hover:bg-ink-800/60 sm:grid-cols-[2fr_1.4fr_1fr_0.8fr_auto]"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold text-white">{u.name || u.login}</span>
              <span className="block truncate text-xs text-slate-500">@{u.login}</span>
            </span>
            <span className="hidden min-w-0 truncate text-xs text-slate-400 sm:block">{u.email || "—"}</span>
            <span className="text-right font-bold tabular-nums text-brand-light">{formatMoney(u.balance)}</span>
            <span className="hidden text-xs text-slate-500 sm:block">{fmtDate(u.createdAt)}</span>
            <span className="justify-self-end">
              {u.blocked ? (
                <span className="rounded bg-live/15 px-1.5 py-0.5 text-[10px] font-bold text-live">BLOQ</span>
              ) : (
                <Icon name="chevronRight" size={16} className="text-slate-600" />
              )}
            </span>
          </button>
        ))}
        {!loading && filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Nenhum cliente encontrado.</p>
        )}
      </div>

      {/* Detalhe do cliente */}
      {sel && selAgg && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={() => setSelId(null)}>
          <div
            className="max-h-[92vh] w-full max-w-md animate-slideUp overflow-y-auto rounded-t-2xl border border-white/10 bg-ink-850 shadow-pop sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-white/5 p-5">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold text-white">{sel.name || sel.login}</h3>
                <p className="text-xs text-slate-400">@{sel.login} · {sel.email || "sem e-mail"}</p>
                {sel.blocked && <span className="mt-1 inline-block rounded bg-live/15 px-2 py-0.5 text-[10px] font-bold text-live">CONTA BLOQUEADA</span>}
              </div>
              <button onClick={() => setSelId(null)} className="rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-white">
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-px bg-ink-700/50 text-sm">
              <Info label="Saldo atual" value={formatMoney(sel.balance)} strong />
              <Info label="Total apostado" value={formatMoney(selAgg.apostado)} />
              <Info label="Depositado" value={formatMoney(selAgg.depositado)} />
              <Info label="Sacado" value={formatMoney(selAgg.sacado)} />
              <Info label="Apostas" value={`${selAgg.nApostas}`} />
              <Info label="Última aposta" value={fmtDate(selAgg.ultima)} />
              <Info label="CPF" value={maskCpf(sel.cpf) || "—"} />
              <Info label="Telefone" value={sel.phone ? formatPhone(sel.phone) : "—"} />
            </div>

            <div className="space-y-3 p-5">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Ajustar saldo</p>
                <div className="flex gap-2">
                  <input
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder="Valor (R$)"
                    className="w-28 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-brand"
                  />
                  <input
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    placeholder="Motivo (opcional)"
                    className="flex-1 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-brand"
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => doAdjust(1)}
                    disabled={busy}
                    className="flex-1 rounded-lg bg-brand py-2 text-sm font-bold text-ink-950 hover:bg-brand-dark disabled:opacity-50"
                  >
                    + Creditar
                  </button>
                  <button
                    onClick={() => doAdjust(-1)}
                    disabled={busy}
                    className="flex-1 rounded-lg border border-ink-600 py-2 text-sm font-bold text-slate-200 hover:bg-ink-800 disabled:opacity-50"
                  >
                    − Debitar
                  </button>
                </div>
              </div>

              <button
                onClick={doBlock}
                disabled={busy}
                className={[
                  "w-full rounded-lg py-2 text-sm font-bold transition disabled:opacity-50",
                  sel.blocked
                    ? "bg-brand/15 text-brand-light hover:bg-brand/25"
                    : "border border-live/40 text-live hover:bg-live/10",
                ].join(" ")}
              >
                {sel.blocked ? "Reativar conta" : "Bloquear conta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="bg-ink-850 px-4 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`tabular-nums ${strong ? "text-base font-bold text-brand-light" : "text-slate-200"}`}>{value}</div>
    </div>
  );
}
