"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminOverview, AdminUserRow } from "@/shared/types";
import { adminOverview, adminSetAffiliateRate } from "@/lib/ws";
import { useStore } from "@/store/useStore";
import { formatMoney } from "@/lib/format";
import { Icon } from "../ui/Icon";

function userGgr(ov: AdminOverview, userId: string): number {
  let apostado = 0;
  let pago = 0;
  for (const b of ov.bets) {
    if (b.userId !== userId) continue;
    apostado += b.stake;
    if (b.status === "won") pago += b.potentialReturn;
    else if (b.status === "cashed_out") pago += b.cashoutValue ?? 0;
  }
  return apostado - pago;
}

interface AffiliateRow {
  aff: AdminUserRow;
  nIndicados: number;
  depositantes: number;
  ggr: number;
  comissao: number;
}

export function AffiliatesManager() {
  const pushToast = useStore((s) => s.pushToast);
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const ack = await adminOverview();
    setLoading(false);
    if (ack.ok && ack.data) {
      const d = ack.data as AdminOverview;
      setData(d);
      setRate(String(Math.round(d.affiliateConfig.revSharePct * 100)));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const afiliados = useMemo<AffiliateRow[]>(() => {
    if (!data) return [];
    const pct = data.affiliateConfig.revSharePct;
    const out: AffiliateRow[] = [];
    for (const aff of data.users) {
      const indicados = data.users.filter((u) => u.referredBy === aff.id);
      if (indicados.length === 0) continue;
      const ggr = indicados.reduce((s, u) => s + userGgr(data, u.id), 0);
      const depositantes = indicados.filter((u) =>
        data.transactions.some((t) => t.userId === u.id && t.type === "deposit" && t.amount > 0),
      ).length;
      out.push({ aff, nIndicados: indicados.length, depositantes, ggr, comissao: Math.max(0, ggr) * pct });
    }
    return out.sort((a, b) => b.comissao - a.comissao);
  }, [data]);

  const totalComissao = afiliados.reduce((s, a) => s + a.comissao, 0);

  const saveRate = async () => {
    const pct = Number(rate) / 100;
    if (!Number.isFinite(pct) || pct < 0 || pct > 1) {
      pushToast({ kind: "error", message: "Informe uma taxa entre 0 e 100." });
      return;
    }
    setBusy(true);
    const ack = await adminSetAffiliateRate(pct);
    setBusy(false);
    if (ack.ok) {
      if (ack.data) setData(ack.data as AdminOverview);
      pushToast({ kind: "success", message: "Taxa de comissão atualizada." });
    } else {
      pushToast({ kind: "error", message: ack.message ?? "Falha ao salvar." });
    }
  };

  return (
    <div className="space-y-4">
      {/* Configuração da taxa */}
      <div className="rounded-xl border border-ink-600 bg-ink-800 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Taxa de comissão (rev-share)</p>
        <p className="mb-2 mt-0.5 text-xs text-slate-500">% do GGR dos indicados que cada afiliado recebe.</p>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-ink-600 bg-ink-900">
            <input
              value={rate}
              onChange={(e) => setRate(e.target.value.replace(/\D/g, "").slice(0, 3))}
              inputMode="numeric"
              className="w-16 bg-transparent px-3 py-2 text-right text-sm text-slate-200 outline-none"
            />
            <span className="pr-3 text-sm text-slate-500">%</span>
          </div>
          <button
            onClick={saveRate}
            disabled={busy}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-ink-950 hover:bg-brand-dark disabled:opacity-50"
          >
            Salvar taxa
          </button>
          <button onClick={load} className="ml-auto rounded-lg border border-ink-600 px-3 py-2 text-sm text-slate-300 hover:bg-ink-800">
            ↻
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Afiliados ativos" value={String(afiliados.length)} />
        <Stat label="Total indicados" value={String(afiliados.reduce((s, a) => s + a.nIndicados, 0))} />
        <Stat label="Comissões a pagar" value={formatMoney(totalComissao)} accent />
      </div>

      <p className="text-xs text-slate-500">{loading ? "Carregando…" : `${afiliados.length} afiliado(s) com indicados`}</p>

      <div className="overflow-hidden rounded-xl border border-ink-600">
        <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 border-b border-ink-700 bg-ink-800 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid">
          <span>Afiliado</span>
          <span className="text-center">Indicados</span>
          <span className="text-center">Depositaram</span>
          <span className="text-right">GGR gerado</span>
          <span className="text-right">Comissão</span>
        </div>
        {afiliados.map((a) => (
          <div
            key={a.aff.id}
            className="grid grid-cols-2 items-center gap-2 border-b border-ink-700/60 px-4 py-2.5 text-sm last:border-0 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr]"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold text-white">{a.aff.name || a.aff.login}</span>
              <span className="block truncate text-xs tracking-widest text-slate-500">{a.aff.affiliateCode}</span>
            </span>
            <span className="text-center tabular-nums text-slate-300">{a.nIndicados}</span>
            <span className="hidden text-center tabular-nums text-slate-300 sm:block">{a.depositantes}</span>
            <span className="hidden text-right tabular-nums text-slate-300 sm:block">{formatMoney(a.ggr)}</span>
            <span className="text-right font-bold tabular-nums text-brand-light">{formatMoney(a.comissao)}</span>
          </div>
        ))}
        {!loading && afiliados.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-500">
            Nenhum afiliado com indicados ainda. Clientes compartilham o link em <b className="text-slate-400">/afiliados</b>.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800 p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${accent ? "text-brand-light" : "text-white"}`}>{value}</div>
    </div>
  );
}
