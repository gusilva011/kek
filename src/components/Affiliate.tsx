"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AffiliateSummary } from "@/shared/types";
import { affiliateSummary } from "@/lib/ws";
import { useStore } from "@/store/useStore";
import { formatMoney } from "@/lib/format";
import { Icon } from "./ui/Icon";

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function Affiliate() {
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);
  const pushToast = useStore((s) => s.pushToast);
  const [data, setData] = useState<AffiliateSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    affiliateSummary().then((ack) => {
      if (!alive) return;
      setLoading(false);
      if (ack.ok && ack.data) setData(ack.data as AffiliateSummary);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
        <Icon name="users" size={40} className="text-brand-light" />
        <h1 className="mt-3 text-xl font-bold text-white">Programa de Afiliados</h1>
        <p className="mt-2 text-sm text-slate-400">
          Faça login para pegar seu link de indicação e acompanhar suas comissões.
        </p>
        <button
          onClick={() => openAuth("login")}
          className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-ink-950 hover:bg-brand-dark"
        >
          Entrar
        </button>
      </div>
    );
  }

  const link = data ? `${origin}/?ref=${data.code}` : "";
  const pct = data ? Math.round(data.revSharePct * 100) : 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      pushToast({ kind: "success", message: "Link copiado!" });
    } catch {
      pushToast({ kind: "info", message: link });
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Indique e Ganhe</h1>
          <p className="text-sm text-slate-400">Ganhe {pct}% do que a casa lucra com os seus indicados.</p>
        </div>
        <Link href="/" className="rounded-lg border border-ink-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-ink-800">
          ← Início
        </Link>
      </div>

      {loading && <p className="py-10 text-center text-sm text-slate-500">Carregando…</p>}

      {data && (
        <>
          <div className="rounded-2xl border border-brand/30 bg-gradient-to-b from-brand/10 to-transparent p-5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-light">
              <Icon name="users" size={14} /> Seu link de indicação
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-ink-600 bg-ink-900 px-3 py-2.5 text-sm text-slate-200">
                {link}
              </code>
              <button
                onClick={copy}
                className="shrink-0 rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-ink-950 hover:bg-brand-dark"
              >
                Copiar
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Seu código: <b className="tracking-widest text-slate-300">{data.code}</b> — compartilhe e cada cadastro
              pelo link entra como seu indicado.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Indicados" value={String(data.totalReferrals)} />
            <Stat label="Depositaram" value={String(data.depositors)} />
            <Stat label="GGR gerado" value={formatMoney(data.totalGgr)} />
            <Stat label="Comissão" value={formatMoney(data.commission)} accent />
          </div>

          <h2 className="mb-2 mt-6 text-sm font-bold text-white">Seus indicados</h2>
          {data.referrals.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-600 px-4 py-8 text-center text-sm text-slate-500">
              Você ainda não tem indicados. Compartilhe seu link para começar!
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-ink-600">
              {data.referrals.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 border-b border-ink-700/60 px-4 py-2.5 text-sm last:border-0"
                >
                  <div className="min-w-0">
                    <span className="block truncate font-semibold text-white">{r.name || r.login}</span>
                    <span className="text-xs text-slate-500">
                      desde {fmtDate(r.createdAt)} · {r.deposited > 0 ? `depositou ${formatMoney(r.deposited)}` : "sem depósito"}
                    </span>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="block text-[10px] uppercase text-slate-500">comissão</span>
                    <span className="font-bold tabular-nums text-brand-light">
                      {formatMoney(Math.max(0, r.ggr) * data.revSharePct)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-ink-700 bg-ink-800/50 p-4 text-xs leading-relaxed text-slate-400">
            <p className="mb-1 font-bold text-slate-300">Como funciona</p>
            Compartilhe seu link → quem se cadastrar por ele vira seu indicado → você recebe{" "}
            <b className="text-brand-light">{pct}%</b> do GGR (o quanto a casa lucra com as apostas dele). Saldo e
            comissões são fictícios (versão demonstrativa).
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800 p-4">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${accent ? "text-brand-light" : "text-white"}`}>{value}</div>
    </div>
  );
}
