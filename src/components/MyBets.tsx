"use client";

import { useMemo, useState } from "react";
import type { Bet } from "@/shared/types";
import { CASHOUT_MARGIN } from "@/shared/types";
import { useStore } from "@/store/useStore";
import { cashout } from "@/lib/ws";
import { formatMoney, formatOdds } from "@/lib/format";
import { ptTeam, ptMatchLabel } from "@/lib/i18n";
import { Icon } from "./ui/Icon";

export function MyBets() {
  const bets = useStore((s) => s.bets);
  const user = useStore((s) => s.user);
  const [tab, setTab] = useState<"open" | "settled">("open");

  const { open, settled } = useMemo(() => {
    const list = Object.values(bets).sort((a, b) => b.placedAt - a.placedAt);
    return {
      open: list.filter((b) => b.status === "open"),
      settled: list.filter((b) => b.status !== "open"),
    };
  }, [bets]);

  const list = tab === "open" ? open : settled;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-ink-800/80 shadow-card">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2.5">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-white">
          <Icon name="ticket" size={15} className="text-slate-400" />
          Minhas apostas
        </h2>
        <div className="flex gap-1 rounded-lg bg-ink-900 p-0.5 text-xs">
          <Tab active={tab === "open"} onClick={() => setTab("open")}>
            Abertas {open.length > 0 && <span className="text-brand-light">{open.length}</span>}
          </Tab>
          <Tab active={tab === "settled"} onClick={() => setTab("settled")}>
            Resolvidas
          </Tab>
        </div>
      </div>

      <div className="p-3">
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            {!user
              ? "Entre na sua conta para ver suas apostas."
              : tab === "open"
                ? "Nenhuma aposta aberta."
                : "Nenhuma aposta resolvida ainda."}
          </p>
        ) : (
          <div className="space-y-2">
            {list.map((bet) => (
              <BetRow key={bet.id} bet={bet} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition",
        active ? "bg-ink-600 text-white" : "text-slate-400 hover:text-slate-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

const STATUS_META: Record<Bet["status"], { label: string; cls: string }> = {
  open: { label: "Aberta", cls: "bg-sky-500/15 text-sky-400" },
  won: { label: "Ganhou", cls: "bg-brand/15 text-brand-light" },
  lost: { label: "Perdeu", cls: "bg-live/15 text-live" },
  cashed_out: { label: "Cashout", cls: "bg-gold/15 text-gold" },
};

function LegDot({ status }: { status: "open" | "won" | "lost" }) {
  const cls = status === "won" ? "bg-brand" : status === "lost" ? "bg-live" : "bg-slate-500";
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cls}`} />;
}

function BetRow({ bet }: { bet: Bet }) {
  const matches = useStore((s) => s.matches);
  const pushToast = useStore((s) => s.pushToast);
  const [submitting, setSubmitting] = useState(false);

  const meta = STATUS_META[bet.status];
  const isMulti = bet.kind === "multi" && bet.legs;

  // Cashout apenas para apostas simples.
  let cashoutValue: number | null = null;
  if (!isMulti && bet.status === "open") {
    const match = matches[bet.matchId];
    if (match && match.status !== "finished") {
      const sel = match.markets.find((m) => m.key === bet.marketKey)?.selections.find((s) => s.id === bet.selectionId);
      if (sel && !sel.suspended) {
        cashoutValue = Math.round(bet.stake * (bet.oddsLocked / sel.odds) * (1 - CASHOUT_MARGIN) * 100) / 100;
      }
    }
  }

  const onCashout = async () => {
    setSubmitting(true);
    const ack = await cashout(bet.id);
    setSubmitting(false);
    pushToast(
      ack.ok
        ? { kind: "success", message: `Cashout de ${formatMoney(ack.bet?.cashoutValue ?? 0)} realizado.` }
        : { kind: "error", message: ack.message ?? "Cashout indisponível." },
    );
  };

  return (
    <div data-testid="bet-row" className="rounded-xl border border-white/5 bg-ink-700/40 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {isMulti ? (
            <div className="flex items-center gap-1.5 font-semibold text-white">
              <Icon name="ticket" size={14} className="text-brand-light" />
              Múltipla · {bet.legs!.length} seleções
            </div>
          ) : (
            <>
              <div className="truncate font-semibold text-white">{ptTeam(bet.selectionLabel)}</div>
              <div className="truncate text-xs text-slate-500">
                {bet.marketName} · {ptMatchLabel(bet.matchLabel)}
              </div>
            </>
          )}
        </div>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${meta.cls}`}>{meta.label}</span>
      </div>

      {isMulti && (
        <div className="mt-2 space-y-1 border-l-2 border-white/10 pl-2.5">
          {bet.legs!.map((leg) => (
            <div key={leg.selectionId} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex min-w-0 items-center gap-1.5">
                <LegDot status={leg.status} />
                <span className="truncate text-slate-300">{ptTeam(leg.selectionLabel)}</span>
                <span className="truncate text-slate-600">· {ptMatchLabel(leg.matchLabel)}</span>
              </span>
              <span className="shrink-0 tabular-nums text-slate-400">{formatOdds(leg.oddsLocked)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-slate-400">
          {formatMoney(bet.stake)} @ {formatOdds(bet.oddsLocked)}
        </span>
        {bet.status === "won" && <span className="font-bold text-brand-light">+ {formatMoney(bet.potentialReturn)}</span>}
        {bet.status === "lost" && <span className="font-bold text-live">- {formatMoney(bet.stake)}</span>}
        {bet.status === "cashed_out" && <span className="font-bold text-gold">+ {formatMoney(bet.cashoutValue ?? 0)}</span>}
        {bet.status === "open" && <span className="text-slate-500">Retorno {formatMoney(bet.potentialReturn)}</span>}
      </div>

      {!isMulti && bet.status === "open" && (
        <button
          onClick={onCashout}
          disabled={cashoutValue === null || submitting}
          data-testid={`cashout:${bet.id}`}
          className={[
            "mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition",
            cashoutValue !== null && !submitting
              ? "bg-gold text-ink-950 hover:bg-gold-dark"
              : "cursor-not-allowed bg-ink-600 text-slate-500",
          ].join(" ")}
        >
          <Icon name="cashout" size={14} />
          {submitting
            ? "Processando…"
            : cashoutValue !== null
              ? `Cashout ${formatMoney(cashoutValue)}`
              : "Cashout indisponível"}
        </button>
      )}
    </div>
  );
}
