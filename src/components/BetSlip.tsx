"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { placeBet, placeMulti } from "@/lib/ws";
import { formatMoney, formatOdds } from "@/lib/format";
import { ptTeam, ptMatchLabel } from "@/lib/i18n";
import { Icon } from "./ui/Icon";

export function BetSlip() {
  const slip = useStore((s) => s.slip);
  const removeSelection = useStore((s) => s.removeSelection);
  const clearSlip = useStore((s) => s.clearSlip);
  const matches = useStore((s) => s.matches);
  const wallet = useStore((s) => s.wallet);
  const pushToast = useStore((s) => s.pushToast);
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);

  const [mode, setMode] = useState<"simples" | "multipla">("simples");
  const [stake, setStake] = useState("25");
  const [submitting, setSubmitting] = useState(false);
  const [validateSecs, setValidateSecs] = useState(0);

  // 2+ seleções = múltipla automaticamente; 1 ou 0 = simples.
  useEffect(() => {
    setMode(slip.length >= 2 ? "multipla" : "simples");
  }, [slip.length]);

  // Resolve odds/disponibilidade ao vivo de cada seleção do bilhete.
  const resolved = slip.map((s) => {
    const match = matches[s.matchId];
    const market = match?.markets.find((m) => m.key === s.marketKey);
    const selection = market?.selections.find((x) => x.id === s.selectionId);
    const available = Boolean(match && market && selection && match.status !== "finished" && !selection.suspended);
    return { s, available, currentOdds: selection?.odds ?? s.oddsAtPick };
  });
  const availableSels = resolved.filter((r) => r.available);
  // Aposta ao vivo passa pela validação anti-fraude (~10s) no servidor.
  const hasLive = availableSels.some((r) => matches[r.s.matchId]?.status === "live");

  // Contagem regressiva de validação ao vivo (feedback durante o delay).
  useEffect(() => {
    if (!submitting || !hasLive) {
      setValidateSecs(0);
      return;
    }
    setValidateSecs(10);
    const iv = setInterval(() => setValidateSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, [submitting, hasLive]);

  const balance = wallet?.balance ?? 0;
  const stakeNum = Number(stake.replace(",", "."));
  const validStake = Number.isFinite(stakeNum) && stakeNum > 0;

  const combinedOdds = availableSels.reduce((p, r) => p * r.currentOdds, 1);
  const simplesTotalStake = validStake ? stakeNum * availableSels.length : 0;
  const simplesReturn = availableSels.reduce((sum, r) => sum + (validStake ? stakeNum * r.currentOdds : 0), 0);
  const multiReturn = validStake ? stakeNum * combinedOdds : 0;
  const totalNeeded = mode === "simples" ? simplesTotalStake : validStake ? stakeNum : 0;
  const insufficient = validStake && totalNeeded > balance;
  const multiTooFew = mode === "multipla" && availableSels.length < 2;

  const canSubmit =
    user && validStake && availableSels.length > 0 && !insufficient && !multiTooFew && !submitting;

  const onSubmit = async () => {
    if (!user) return openAuth("login");
    if (!canSubmit) return;
    setSubmitting(true);

    if (mode === "multipla") {
      const ack = await placeMulti({
        selections: availableSels.map((r) => ({
          matchId: r.s.matchId,
          marketKey: r.s.marketKey,
          selectionId: r.s.selectionId,
          expectedOdds: r.currentOdds,
        })),
        stake: stakeNum,
      });
      setSubmitting(false);
      if (ack.ok) {
        pushToast({ kind: "success", message: `Múltipla confirmada @ ${formatOdds(combinedOdds)}` });
        clearSlip();
      } else {
        pushToast({ kind: "error", message: ack.message ?? "Falha ao apostar." });
      }
      return;
    }

    // Simples: uma aposta por seleção (mesmo valor em cada).
    let ok = 0;
    for (const r of availableSels) {
      const ack = await placeBet({
        matchId: r.s.matchId,
        marketKey: r.s.marketKey,
        selectionId: r.s.selectionId,
        stake: stakeNum,
        expectedOdds: r.currentOdds,
      });
      if (ack.ok) {
        ok++;
        removeSelection(r.s.selectionId);
      }
    }
    setSubmitting(false);
    pushToast(
      ok > 0
        ? { kind: "success", message: `${ok} aposta(s) confirmada(s).` }
        : { kind: "error", message: "Não foi possível apostar." },
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-ink-800/80 shadow-card">
      <div className="flex border-b border-white/5">
        {(["simples", "multipla"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setMode(t)}
            className={[
              "flex flex-1 items-center justify-center gap-1.5 px-3 py-3 text-sm font-bold transition",
              mode === t ? "bg-ink-700 text-white" : "text-slate-400 hover:text-slate-200",
            ].join(" ")}
          >
            <Icon name="ticket" size={15} />
            {t === "simples" ? "Simples" : "Múltipla"}
            {t === "multipla" && slip.length >= 2 && (
              <span className="rounded bg-brand/20 px-1.5 text-xs font-bold text-brand-light">{slip.length}</span>
            )}
          </button>
        ))}
      </div>

      {slip.length === 0 ? (
        <div className="p-3">
          <EmptyState />
        </div>
      ) : (
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>{slip.length} seleção(ões)</span>
            <button onClick={clearSlip} className="font-semibold text-slate-400 hover:text-live">
              Limpar tudo
            </button>
          </div>

          <div className="space-y-1.5">
            {resolved.map((r) => (
              <div key={r.s.selectionId} className="rounded-lg border border-white/5 bg-ink-700/50 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{ptTeam(r.s.selectionLabel)}</div>
                    <div className="truncate text-[11px] text-slate-500">
                      {r.s.marketName} · {ptMatchLabel(r.s.matchLabel)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-bold tabular-nums text-white">{formatOdds(r.currentOdds)}</span>
                    <button
                      onClick={() => removeSelection(r.s.selectionId)}
                      className="rounded p-0.5 text-slate-500 hover:bg-white/5 hover:text-white"
                      aria-label="Remover"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                </div>
                {!r.available && <div className="mt-1 text-[11px] text-amber-400">Indisponível — será ignorada.</div>}
              </div>
            ))}
          </div>

          {multiTooFew && (
            <div className="mt-2 rounded-lg bg-ink-700/50 px-3 py-2 text-xs text-slate-400">
              Adicione ao menos 2 seleções (de jogos diferentes) para a múltipla.
            </div>
          )}

          <div className="mt-3">
            <label className="mb-1 block text-xs text-slate-400">
              Valor {mode === "simples" ? "por aposta" : "da múltipla"}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                R$
              </span>
              <input
                inputMode="decimal"
                data-testid="stake-input"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="w-full rounded-xl border border-white/5 bg-ink-900 py-2.5 pl-9 pr-3 text-right text-lg font-bold tabular-nums outline-none focus:border-brand/60"
              />
            </div>
          </div>

          <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-sm">
            {mode === "multipla" ? (
              <>
                <Row label="Odds totais" value={formatOdds(combinedOdds)} />
                <Row label="Total apostado" value={formatMoney(validStake ? stakeNum : 0)} />
                <Row label="Retorno potencial" value={formatMoney(multiReturn)} strong />
              </>
            ) : (
              <>
                <Row label="Total apostado" value={formatMoney(simplesTotalStake)} />
                <Row label="Retorno potencial" value={formatMoney(simplesReturn)} strong />
              </>
            )}
            <Row label="Saldo disponível" value={formatMoney(balance)} muted />
          </div>

          {insufficient && <p className="mt-2 text-xs text-live">Saldo insuficiente para essa aposta.</p>}

          {!user ? (
            <button
              onClick={() => openAuth("login")}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-bold text-ink-950 shadow-glow transition hover:bg-brand-dark"
            >
              <Icon name="user" size={16} /> Entrar para apostar
            </button>
          ) : (
            <button
              onClick={onSubmit}
              disabled={!canSubmit}
              data-testid="confirm-bet"
              className={[
                "mt-3 w-full rounded-xl py-3 text-sm font-bold transition",
                canSubmit ? "bg-brand text-ink-950 shadow-glow hover:bg-brand-dark" : "cursor-not-allowed bg-ink-600 text-slate-500",
              ].join(" ")}
            >
              {submitting
                ? hasLive
                  ? `Validando ao vivo… ${validateSecs}s`
                  : "Processando…"
                : mode === "multipla"
                  ? "Confirmar múltipla"
                  : `Confirmar ${availableSels.length || ""} aposta(s)`.trim()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ink-700 text-slate-500">
        <Icon name="ticket" size={24} />
      </div>
      <p className="text-sm font-semibold text-slate-300">Seu bilhete está vazio</p>
      <p className="mt-1 text-xs text-slate-500">
        Clique em odds para montar. Várias seleções = aposta múltipla!
      </p>
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-slate-500" : "text-slate-400"}>{label}</span>
      <span className={strong ? "font-bold tabular-nums text-brand-light" : "tabular-nums text-slate-200"}>
        {value}
      </span>
    </div>
  );
}
