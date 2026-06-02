"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminOverview, AdminTxnRow } from "@/shared/types";
import { adminOverview } from "@/lib/ws";
import { useStore } from "@/store/useStore";
import { formatMoney, formatMoneyCompact, formatInt, formatAgo } from "@/lib/format";
import { Icon, type IconName } from "../ui/Icon";
import { ComboChart, Donut, Funnel, Sparkline, C, type ComboPoint } from "./charts";

type PeriodKey = "today" | "7d" | "30d" | "90d" | "year" | "all" | "custom";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DAY = 86_400_000;

function startOfDay(d: number): number {
  const x = new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
}

function periodRange(key: PeriodKey, month: number, year: number): { from: number; to: number; label: string } {
  const now = Date.now();
  const end = now + 1000;
  switch (key) {
    case "today":
      return { from: startOfDay(now), to: end, label: "Hoje" };
    case "7d":
      return { from: end - 7 * DAY, to: end, label: "Últimos 7 dias" };
    case "30d":
      return { from: end - 30 * DAY, to: end, label: "Últimos 30 dias" };
    case "90d":
      return { from: end - 90 * DAY, to: end, label: "Últimos 90 dias" };
    case "year":
      return { from: new Date(new Date().getFullYear(), 0, 1).getTime(), to: end, label: "Este ano" };
    case "all":
      return { from: 0, to: end, label: "Todo o período" };
    case "custom":
      return {
        from: new Date(year, month, 1).getTime(),
        to: new Date(year, month + 1, 1).getTime(),
        label: `${MESES[month]}/${year}`,
      };
  }
}

const inRange = (ts: number, from: number, to: number) => ts >= from && ts < to;

/* ---------------- métricas agregadas ---------------- */

function computeMetrics(d: AdminOverview, from: number, to: number) {
  const clientes = d.users.filter((u) => u.role === "user");
  const deps = d.transactions.filter((t) => t.type === "deposit" && inRange(t.at, from, to));
  const saqs = d.transactions.filter((t) => t.type === "withdraw" && inRange(t.at, from, to));
  const betsR = d.bets.filter((b) => inRange(b.placedAt, from, to));
  const pago = d.transactions
    .filter((t) => (t.type === "win" || t.type === "cashout") && inRange(t.at, from, to))
    .reduce((s, t) => s + t.amount, 0);
  const totalApostado = betsR.reduce((s, b) => s + b.stake, 0);
  const depSum = deps.reduce((s, t) => s + t.amount, 0);
  const saqSum = saqs.reduce((s, t) => s + Math.abs(t.amount), 0);

  const status = { won: 0, lost: 0, cashed_out: 0, open: 0 };
  for (const b of betsR) status[b.status] = (status[b.status] ?? 0) + 1;

  return {
    novos: clientes.filter((u) => inRange(u.createdAt, from, to)).length,
    apostadores: new Set(betsR.map((b) => b.userId)).size,
    qtdApostas: betsR.length,
    totalApostado,
    pago,
    depCount: deps.length,
    depSum,
    saqCount: saqs.length,
    saqSum,
    ggr: totalApostado - pago,
    margem: totalApostado > 0 ? (totalApostado - pago) / totalApostado : 0,
    depLiquido: depSum - saqSum,
    status,
  };
}

type Metrics = ReturnType<typeof computeMetrics>;

/* ---------------- série temporal (buckets) ---------------- */

type Granularity = "hour" | "day" | "week" | "month";

function buildSeries(d: AdminOverview, from: number, to: number) {
  const span = to - from;
  const gran: Granularity = span <= 2.2 * DAY ? "hour" : span <= 46 * DAY ? "day" : span <= 220 * DAY ? "week" : "month";

  const start0 = gran === "month" ? new Date(new Date(from).getFullYear(), new Date(from).getMonth(), 1).getTime() : startOfDay(from);
  const bucketMs = gran === "hour" ? 3_600_000 : gran === "day" ? DAY : 7 * DAY;

  let count: number;
  const indexOf = (ts: number) => {
    if (gran === "month") {
      const a = new Date(start0);
      const b = new Date(ts);
      return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    }
    return Math.floor((ts - start0) / bucketMs);
  };
  if (gran === "month") {
    const a = new Date(start0);
    const b = new Date(to);
    count = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
  } else {
    count = Math.max(1, Math.ceil((to - start0) / bucketMs));
  }
  count = Math.min(count, 200);

  const apostado = new Array(count).fill(0);
  const pago = new Array(count).fill(0);
  const deposito = new Array(count).fill(0);
  const saque = new Array(count).fill(0);
  const novos = new Array(count).fill(0);

  for (const b of d.bets) {
    if (!inRange(b.placedAt, from, to)) continue;
    const i = indexOf(b.placedAt);
    if (i >= 0 && i < count) apostado[i] += b.stake;
  }
  for (const t of d.transactions) {
    if (!inRange(t.at, from, to)) continue;
    const i = indexOf(t.at);
    if (i < 0 || i >= count) continue;
    if (t.type === "win" || t.type === "cashout") pago[i] += t.amount;
    else if (t.type === "deposit") deposito[i] += t.amount;
    else if (t.type === "withdraw") saque[i] += Math.abs(t.amount);
  }
  for (const u of d.users) {
    if (u.role !== "user" || !inRange(u.createdAt, from, to)) continue;
    const i = indexOf(u.createdAt);
    if (i >= 0 && i < count) novos[i] += 1;
  }

  const label = (i: number): string => {
    if (gran === "month") {
      const dt = new Date(start0);
      dt.setMonth(dt.getMonth() + i);
      return MESES[dt.getMonth()];
    }
    const dt = new Date(start0 + i * bucketMs);
    if (gran === "hour") return `${dt.getHours()}h`;
    return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
  };

  const ggr = apostado.map((a, i) => a - pago[i]);
  const labels = Array.from({ length: count }, (_, i) => label(i));
  return { labels, apostado, pago, deposito, saque, novos, ggr };
}

/* ================================================================== */

export function Dashboard() {
  // Seletor primitivo: re-renderiza só quando a CONTAGEM ao vivo muda (não a
  // cada tick de placar), evitando re-render do painel inteiro a cada 2s.
  const liveCount = useStore((s) => {
    let n = 0;
    for (const k in s.matches) if (s.matches[k].status === "live") n++;
    return n;
  });
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [chartMode, setChartMode] = useState<"apostas" | "caixa">("apostas");
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  const load = async () => {
    setLoading(true);
    setErr(null);
    const ack = await adminOverview();
    setLoading(false);
    if (ack.ok && ack.data) setData(ack.data as AdminOverview);
    else setErr(ack.message ?? "Falha ao carregar os dados.");
  };

  useEffect(() => {
    load();
  }, []);

  const range = useMemo(() => periodRange(period, month, year), [period, month, year]);
  const m = useMemo(() => (data ? computeMetrics(data, range.from, range.to) : null), [data, range]);
  const prev = useMemo<Metrics | null>(() => {
    if (!data) return null;
    const span = range.to - range.from;
    const pfrom = Math.max(0, range.from - span);
    return computeMetrics(data, pfrom, range.from);
  }, [data, range]);
  const series = useMemo(() => (data ? buildSeries(data, range.from, range.to) : null), [data, range]);

  // Métricas "agora" (independentes do período): caixa, exposição, bloqueios.
  const lifetime = useMemo(() => {
    if (!data) return null;
    const clientes = data.users.filter((u) => u.role === "user");
    return {
      saldoCaixa: clientes.reduce((s, u) => s + u.balance, 0),
      exposicao: data.bets.filter((b) => b.status === "open").reduce((s, b) => s + b.potentialReturn, 0),
      bloqueados: clientes.filter((u) => u.blocked).length,
    };
  }, [data]);

  // Visão sensível ao período: funil de aquisição da COORTE (quem se cadastrou no
  // período) e ranking por volume apostado NO período.
  const periodView = useMemo(() => {
    if (!data) return null;
    const { from, to } = range;
    const clientes = data.users.filter((u) => u.role === "user");
    const cohort = clientes.filter((u) => inRange(u.createdAt, from, to));
    const cohortIds = new Set(cohort.map((u) => u.id));
    const depIds = new Set(
      data.transactions.filter((t) => t.type === "deposit" && cohortIds.has(t.userId)).map((t) => t.userId),
    );
    const wdrIds = new Set(
      data.transactions.filter((t) => t.type === "withdraw" && cohortIds.has(t.userId)).map((t) => t.userId),
    );
    const betIds = new Set(data.bets.filter((b) => cohortIds.has(b.userId)).map((b) => b.userId));

    const byUser = new Map<string, { apostado: number; pago: number }>();
    for (const b of data.bets) {
      if (!inRange(b.placedAt, from, to)) continue;
      const e = byUser.get(b.userId) ?? { apostado: 0, pago: 0 };
      e.apostado += b.stake;
      if (b.status === "won") e.pago += b.potentialReturn;
      else if (b.status === "cashed_out") e.pago += b.cashoutValue ?? 0;
      byUser.set(b.userId, e);
    }
    const nameOf = (id: string) => data.users.find((u) => u.id === id)?.name || "—";
    const top = Array.from(byUser.entries())
      .map(([id, e]) => ({ id, name: nameOf(id), apostado: e.apostado, ggr: e.apostado - e.pago }))
      .sort((a, b) => b.apostado - a.apostado)
      .slice(0, 6);

    return { cohort: cohort.length, cohortBet: betIds.size, cohortDep: depIds.size, cohortWdr: wdrIds.size, top };
  }, [data, range]);

  const feed = useMemo(() => {
    if (!data) return [];
    const nameOf = (id: string) => data.users.find((u) => u.id === id)?.name || "Cliente";
    return data.transactions
      .filter((t) => t.type === "deposit" || t.type === "withdraw" || t.type === "win" || t.type === "cashout")
      .slice()
      .sort((a, b) => b.at - a.at)
      .slice(0, 9)
      .map((t) => ({ ...t, name: nameOf(t.userId) }));
  }, [data]);

  const anos = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  const chartPoints: ComboPoint[] = useMemo(() => {
    if (!series) return [];
    const valueArr = chartMode === "apostas" ? series.apostado : series.deposito;
    const lineArr = chartMode === "apostas" ? series.ggr : series.saque;
    return series.labels.map((label, i) => ({ label, value: valueArr[i], line: lineArr[i] }));
  }, [series, chartMode]);

  return (
    <div className="space-y-5">
      {/* Filtro de período */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Icon name="filter" size={14} /> Período
        </span>
        {([
          ["today", "Hoje"],
          ["7d", "7 dias"],
          ["30d", "30 dias"],
          ["90d", "90 dias"],
          ["year", "Ano"],
          ["all", "Tudo"],
        ] as [PeriodKey, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            className={[
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              period === k ? "bg-brand text-ink-950 shadow-glow" : "bg-ink-800 text-slate-300 hover:bg-ink-700",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
        <div className="flex items-center gap-1 rounded-lg bg-ink-800 p-1">
          <select
            value={month}
            onChange={(e) => {
              setMonth(Number(e.target.value));
              setPeriod("custom");
            }}
            className="rounded bg-transparent px-1 py-1 text-sm text-slate-200 outline-none"
          >
            {MESES.map((mes, i) => (
              <option key={i} value={i} className="bg-ink-800">
                {mes}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setPeriod("custom");
            }}
            className="rounded bg-transparent px-1 py-1 text-sm text-slate-200 outline-none"
          >
            {anos.map((a) => (
              <option key={a} value={a} className="bg-ink-800">
                {a}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={load}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-ink-800"
        >
          <span className={loading ? "animate-spin" : ""}>↻</span> Atualizar
        </button>
      </div>

      {err && <div className="rounded-lg border border-live/40 bg-live/10 px-3 py-2 text-sm text-live">{err}</div>}
      {loading && !data && <SkeletonDash />}

      {m && prev && series && lifetime && periodView && (
        <>
          <p className="text-xs text-slate-500">
            Mostrando <b className="text-slate-300">{range.label}</b> · {data!.users.filter((u) => u.role === "user").length} clientes ·
            comparação com o período anterior
          </p>

          {/* KPIs principais */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              icon="trophy"
              label="GGR (receita)"
              value={formatMoneyCompact(m.ggr)}
              exact={formatMoney(m.ggr)}
              trend={trendPct(m.ggr, prev.ggr)}
              spark={series.ggr}
              sparkColor={C.brand}
              accent
              foot={`margem ${(m.margem * 100).toFixed(1)}%`}
            />
            <Kpi
              icon="wallet"
              label="Depósitos"
              value={formatMoneyCompact(m.depSum)}
              exact={formatMoney(m.depSum)}
              trend={trendPct(m.depSum, prev.depSum)}
              spark={series.deposito}
              sparkColor={C.blue}
              foot={`${formatInt(m.depCount)} depósitos`}
            />
            <Kpi
              icon="chart"
              label="Total apostado"
              value={formatMoneyCompact(m.totalApostado)}
              exact={formatMoney(m.totalApostado)}
              trend={trendPct(m.totalApostado, prev.totalApostado)}
              spark={series.apostado}
              sparkColor={C.violet}
              foot={`${formatInt(m.qtdApostas)} apostas`}
            />
            <Kpi
              icon="star"
              label="Novos clientes"
              value={formatInt(m.novos)}
              trend={trendPct(m.novos, prev.novos)}
              spark={series.novos}
              sparkColor={C.gold}
              foot={`${formatInt(m.apostadores)} apostaram`}
            />
          </div>

          {/* Gráfico principal */}
          <Panel
            title="Movimentação no período"
            icon="chart"
            right={
              <div className="flex gap-1 rounded-lg bg-ink-900 p-0.5">
                <SegBtn active={chartMode === "apostas"} onClick={() => setChartMode("apostas")}>
                  Apostas & GGR
                </SegBtn>
                <SegBtn active={chartMode === "caixa"} onClick={() => setChartMode("caixa")}>
                  Caixa
                </SegBtn>
              </div>
            }
          >
            <ComboChart
              points={chartPoints}
              format={formatMoneyCompact}
              barColor={chartMode === "apostas" ? C.violet : C.blue}
              lineColor={chartMode === "apostas" ? C.brand : C.live}
              valueName={chartMode === "apostas" ? "Apostado" : "Depósitos"}
              lineName={chartMode === "apostas" ? "GGR" : "Saques"}
            />
          </Panel>

          {/* Funil + Donut + Resumo financeiro */}
          <div className="grid gap-3 lg:grid-cols-3">
            <Panel title="Funil de aquisição" icon="users" hint="coorte de cadastros do período">
              <Funnel
                format={formatInt}
                steps={[
                  { label: "Cadastraram-se", value: periodView.cohort, color: C.blue },
                  { label: "Apostaram", value: periodView.cohortBet, color: C.violet },
                  { label: "Depositaram", value: periodView.cohortDep, color: C.brand },
                  { label: "Sacaram", value: periodView.cohortWdr, color: C.gold },
                ]}
              />
            </Panel>

            <Panel title="Apostas por status" icon="ticket" hint="no período">
              <Donut
                centerLabel="Apostas"
                centerValue={formatInt(m.qtdApostas)}
                slices={[
                  { label: "Perdidas (casa)", value: m.status.lost, color: C.brand },
                  { label: "Ganhas (cliente)", value: m.status.won, color: C.live },
                  { label: "Cashout", value: m.status.cashed_out, color: C.gold },
                  { label: "Abertas", value: m.status.open, color: C.blue },
                ]}
              />
            </Panel>

            <Panel title="Resumo financeiro" icon="wallet" hint={range.label}>
              <ul className="divide-y divide-white/5 text-sm">
                <FinRow label="Prêmios pagos" value={formatMoney(m.pago)} />
                <FinRow label="Saques" value={formatMoney(m.saqSum)} sub={`${m.saqCount} solicitações`} />
                <FinRow label="Depósito líquido" value={formatMoney(m.depLiquido)} accent={m.depLiquido >= 0} />
                <FinRow label="Saldo em caixa" value={formatMoney(lifetime.saldoCaixa)} sub="carteiras dos clientes" />
                <FinRow label="Exposição em aberto" value={formatMoney(lifetime.exposicao)} sub="retorno potencial" danger />
              </ul>
            </Panel>
          </div>

          {/* Ranking + Atividade */}
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Maiores clientes" icon="trophy" hint="por volume apostado no período">
              <ul className="space-y-2.5">
                {periodView.top.map((t, i) => {
                  const max = periodView.top[0]?.apostado || 1;
                  return (
                    <li key={t.id} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-700 text-xs font-bold text-slate-300">
                        {i + 1}
                      </span>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand/30 to-violet-500/20 text-xs font-bold text-brand-light">
                        {initials(t.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-white">{t.name}</span>
                          <span className="shrink-0 tabular-nums text-sm font-bold text-slate-200">{formatMoney(t.apostado)}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-900">
                          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-brand" style={{ width: `${(t.apostado / max) * 100}%` }} />
                        </div>
                      </div>
                    </li>
                  );
                })}
                {periodView.top.length === 0 && (
                  <li className="py-6 text-center text-sm text-slate-600">Sem apostas no período.</li>
                )}
              </ul>
            </Panel>

            <Panel title="Atividade recente" icon="bell" hint="últimas transações">
              <ul className="space-y-1">
                {feed.map((t, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-lg px-1.5 py-1.5 hover:bg-white/5">
                    <span className={["flex h-8 w-8 shrink-0 items-center justify-center rounded-full", txStyle(t).bg].join(" ")}>
                      <Icon name={txStyle(t).icon} size={15} className={txStyle(t).fg} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-slate-200">{t.name}</div>
                      <div className="text-xs text-slate-500">{txStyle(t).label}</div>
                    </div>
                    <div className="text-right">
                      <div className={["tabular-nums text-sm font-bold", t.amount >= 0 ? "text-brand-light" : "text-slate-300"].join(" ")}>
                        {t.amount >= 0 ? "+" : "−"}
                        {formatMoney(Math.abs(t.amount)).replace("R$", "R$ ")}
                      </div>
                      <div className="text-[10px] text-slate-600">{formatAgo(t.at)}</div>
                    </div>
                  </li>
                ))}
                {feed.length === 0 && <li className="py-6 text-center text-sm text-slate-600">Nenhuma movimentação.</li>}
              </ul>
            </Panel>
          </div>

          {/* Operação ao vivo */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat icon="live" label="Jogos ao vivo" value={formatInt(liveCount)} live />
            <MiniStat icon="ticket" label="Apostas abertas" value={formatInt(m.status.open)} />
            <MiniStat icon="cashout" label="Exposição" value={formatMoneyCompact(lifetime.exposicao)} />
            <MiniStat icon="shield" label="Contas bloqueadas" value={formatInt(lifetime.bloqueados)} />
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- helpers de apresentação ---------------- */

function trendPct(cur: number, prev: number): number | null {
  if (!Number.isFinite(prev) || prev <= 0) return null;
  return (cur - prev) / prev;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function txStyle(t: AdminTxnRow): { icon: IconName; label: string; bg: string; fg: string } {
  switch (t.type) {
    case "deposit":
      return { icon: "wallet", label: "Depósito via Pix", bg: "bg-brand/15", fg: "text-brand-light" };
    case "withdraw":
      return { icon: "cashout", label: "Saque Pix", bg: "bg-amber-500/15", fg: "text-gold" };
    case "win":
      return { icon: "trophy", label: "Prêmio pago", bg: "bg-live/15", fg: "text-live" };
    case "cashout":
      return { icon: "bolt", label: "Cashout", bg: "bg-violet-500/15", fg: "text-violet-300" };
    default:
      return { icon: "info", label: "Movimentação", bg: "bg-ink-700", fg: "text-slate-300" };
  }
}

function Kpi({
  icon,
  label,
  value,
  exact,
  trend,
  spark,
  sparkColor,
  accent,
  foot,
}: {
  icon: IconName;
  label: string;
  value: string;
  exact?: string;
  trend: number | null;
  spark: number[];
  sparkColor: string;
  accent?: boolean;
  foot?: string;
}) {
  return (
    <div className="card-hover rounded-2xl border border-ink-600 bg-gradient-to-b from-ink-800 to-ink-850 p-4 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-500">
            <Icon name={icon} size={13} /> {label}
          </div>
          <div className={["mt-1 text-2xl font-extrabold tabular-nums", accent ? "text-brand-light" : "text-white"].join(" ")} title={exact}>
            {value}
          </div>
        </div>
        {trend !== null && <TrendChip pct={trend} />}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="text-[11px] text-slate-600">{foot}</span>
        <Sparkline data={spark.length ? spark : [0, 0]} color={sparkColor} width={104} height={32} />
      </div>
    </div>
  );
}

function TrendChip({ pct }: { pct: number }) {
  const up = pct >= 0;
  const big = Math.abs(pct) >= 10;
  return (
    <span
      className={[
        "flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums",
        up ? "bg-brand/15 text-brand-light" : "bg-live/15 text-live",
      ].join(" ")}
      title="vs. período anterior"
    >
      {up ? "▲" : "▼"} {big ? Math.round(Math.abs(pct) * 100) : (Math.abs(pct) * 100).toFixed(0)}%
    </span>
  );
}

function Panel({
  title,
  icon,
  hint,
  right,
  children,
}: {
  title: string;
  icon: IconName;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-850 p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-700 text-brand-light">
            <Icon name={icon} size={15} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-white">{title}</h3>
            {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
          </div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={["rounded-md px-2.5 py-1 text-xs font-semibold transition", active ? "bg-ink-600 text-white" : "text-slate-400 hover:text-slate-200"].join(" ")}
    >
      {children}
    </button>
  );
}

function FinRow({ label, value, sub, accent, danger }: { label: string; value: string; sub?: string; accent?: boolean; danger?: boolean }) {
  return (
    <li className="flex items-center justify-between py-2.5">
      <div>
        <div className="text-slate-300">{label}</div>
        {sub && <div className="text-[11px] text-slate-600">{sub}</div>}
      </div>
      <span className={["tabular-nums font-bold", danger ? "text-gold" : accent ? "text-brand-light" : "text-white"].join(" ")}>{value}</span>
    </li>
  );
}

function MiniStat({ icon, label, value, live }: { icon: IconName; label: string; value: string; live?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3">
      <span className={["flex h-9 w-9 items-center justify-center rounded-lg", live ? "bg-live/15 text-live" : "bg-ink-700 text-slate-300"].join(" ")}>
        <Icon name={icon} size={17} className={live ? "animate-livePulse" : ""} />
      </span>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-lg font-bold tabular-nums text-white">{value}</div>
      </div>
    </div>
  );
}

function SkeletonDash() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-ink-600 bg-ink-800" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl border border-ink-600 bg-ink-800" />
    </div>
  );
}
