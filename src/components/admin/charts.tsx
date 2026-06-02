"use client";

/**
 * Primitivas de visualização do backoffice — SVG puro, sem dependências.
 * Tema escuro, paleta brand/live/gold. Todas escalam por viewBox (responsivas)
 * e os tooltips são HTML posicionados por porcentagem, então funcionam em
 * qualquer largura de card.
 */

import { useId, useState } from "react";

export const C = {
  brand: "#15cb80",
  brandLight: "#3ce99e",
  live: "#ff4d63",
  gold: "#ffce47",
  blue: "#3b82f6",
  violet: "#8b5cf6",
  grid: "rgba(255,255,255,0.06)",
  axis: "rgba(255,255,255,0.28)",
};

/* ------------------------------------------------------------------ */
/* Sparkline — mini linha com área (usada nos KPIs)                    */
/* ------------------------------------------------------------------ */

export function Sparkline({
  data,
  color = C.brand,
  width = 120,
  height = 36,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const gid = useId();
  if (!data || data.length === 0) return <svg width={width} height={height} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pad = 2;
  const stepX = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0;
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const pts = data.map((v, i) => `${pad + i * stepX},${y(v)}`);
  const line = `M ${pts.join(" L ")}`;
  const area = `${line} L ${pad + (data.length - 1) * stepX},${height - pad} L ${pad},${height - pad} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pad + (data.length - 1) * stepX} cy={y(data[data.length - 1])} r={2.4} fill={color} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* ComboChart — barras (série principal) + linha (série secundária)    */
/* ------------------------------------------------------------------ */

export interface ComboPoint {
  label: string;
  value: number;
  line?: number;
}

export function ComboChart({
  points,
  barColor = C.brand,
  lineColor = C.gold,
  valueName = "Valor",
  lineName = "Linha",
  format,
  height = 220,
}: {
  points: ComboPoint[];
  barColor?: string;
  lineColor?: string;
  valueName?: string;
  lineName?: string;
  format: (v: number) => string;
  height?: number;
}) {
  const gid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 760;
  const H = 240;
  const padL = 12;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const hasLine = points.some((p) => p.line !== undefined);

  if (points.length === 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-slate-600">Sem dados no período.</div>;
  }

  const maxVal = Math.max(...points.map((p) => p.value), 1);
  const maxLine = Math.max(...points.map((p) => p.line ?? 0), 1);
  const minLine = Math.min(...points.map((p) => p.line ?? 0), 0);
  const lineSpan = maxLine - minLine || 1;

  const n = points.length;
  const slot = plotW / n;
  const barW = Math.max(3, Math.min(34, slot * 0.6));
  const cx = (i: number) => padL + slot * i + slot / 2;
  const barH = (v: number) => (v / maxVal) * plotH;
  const lineY = (v: number) => padT + plotH - ((v - minLine) / lineSpan) * plotH;

  const linePts = hasLine ? points.map((p, i) => `${cx(i)},${lineY(p.line ?? 0)}`) : [];
  const linePath = linePts.length ? `M ${linePts.join(" L ")}` : "";

  // Rótulos do eixo X afinados para caber.
  const labelEvery = Math.ceil(n / 8);
  const gridLines = [0.25, 0.5, 0.75, 1];

  return (
    <div className="relative">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`bar-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={barColor} stopOpacity={0.95} />
            <stop offset="100%" stopColor={barColor} stopOpacity={0.45} />
          </linearGradient>
        </defs>

        {/* grade horizontal */}
        {gridLines.map((g) => (
          <line key={g} x1={padL} x2={W - padR} y1={padT + plotH * (1 - g)} y2={padT + plotH * (1 - g)} stroke={C.grid} strokeWidth={1} />
        ))}

        {/* barras */}
        {points.map((p, i) => {
          const h = barH(p.value);
          const active = hover === i;
          return (
            <g key={i}>
              <rect
                x={cx(i) - barW / 2}
                y={padT + plotH - h}
                width={barW}
                height={Math.max(0, h)}
                rx={Math.min(4, barW / 2)}
                fill={`url(#bar-${gid})`}
                opacity={hover === null || active ? 1 : 0.45}
              />
              {/* faixa de hover (transparente, cobre o slot inteiro) */}
              <rect
                x={padL + slot * i}
                y={padT}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              />
            </g>
          );
        })}

        {/* linha secundária */}
        {hasLine && (
          <>
            <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {points.map((p, i) =>
              hover === i ? <circle key={i} cx={cx(i)} cy={lineY(p.line ?? 0)} r={3.4} fill={lineColor} stroke="#0a0e15" strokeWidth={1.5} /> : null,
            )}
          </>
        )}

        {/* rótulos X */}
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={i} x={cx(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={C.axis}>
              {p.label}
            </text>
          ) : null,
        )}
      </svg>

      {/* legenda */}
      <div className="mt-1 flex items-center gap-4 px-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: barColor }} /> {valueName}
        </span>
        {hasLine && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3.5 rounded" style={{ background: lineColor }} /> {lineName}
          </span>
        )}
      </div>

      {/* tooltip */}
      {hover !== null && points[hover] && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-white/10 bg-ink-950/95 px-3 py-2 text-xs shadow-pop"
          style={{ left: `${((hover + 0.5) / n) * 100}%` }}
        >
          <div className="mb-1 font-semibold text-slate-200">{points[hover].label}</div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: barColor }} />
            {valueName}: <b className="tabular-nums text-white">{format(points[hover].value)}</b>
          </div>
          {hasLine && (
            <div className="mt-0.5 flex items-center gap-1.5 text-slate-300">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: lineColor }} />
              {lineName}: <b className="tabular-nums text-white">{format(points[hover].line ?? 0)}</b>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Donut — composição (com total no centro)                            */
/* ------------------------------------------------------------------ */

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function Donut({
  slices,
  size = 168,
  thickness = 22,
  centerLabel,
  centerValue,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={thickness} />
        {total > 0 &&
          slices.map((s, i) => {
            const frac = Math.max(0, s.value) / total;
            const len = frac * circ;
            const seg = (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return seg;
          })}
      </svg>
      <div className="min-w-0">
        {(centerValue || centerLabel) && (
          <div className="mb-2">
            {centerLabel && <div className="text-[11px] uppercase tracking-wide text-slate-500">{centerLabel}</div>}
            {centerValue && <div className="text-xl font-bold tabular-nums text-white">{centerValue}</div>}
          </div>
        )}
        <ul className="space-y-1.5">
          {slices.map((s, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="truncate text-slate-400">{s.label}</span>
              <span className="ml-auto tabular-nums font-semibold text-slate-200">
                {total > 0 ? Math.round((Math.max(0, s.value) / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Funnel — funil de conversão (passos com %)                          */
/* ------------------------------------------------------------------ */

export interface FunnelStep {
  label: string;
  value: number;
  color: string;
}

export function Funnel({ steps, format }: { steps: FunnelStep[]; format: (v: number) => string }) {
  const top = steps[0]?.value || 1;
  return (
    <div className="space-y-2.5">
      {steps.map((s, i) => {
        const pctOfTop = Math.round((s.value / top) * 100);
        const pctOfPrev = i === 0 ? 100 : Math.round((s.value / (steps[i - 1].value || 1)) * 100);
        return (
          <div key={i}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="font-medium text-slate-300">{s.label}</span>
              <span className="tabular-nums text-slate-400">
                <b className="text-slate-100">{format(s.value)}</b>
                {i > 0 && <span className="ml-1.5 text-slate-500">({pctOfPrev}% do passo anterior)</span>}
              </span>
            </div>
            <div className="h-7 w-full overflow-hidden rounded-md bg-ink-900">
              <div
                className="flex h-full items-center justify-end rounded-md px-2 text-[11px] font-bold text-ink-950 transition-all"
                style={{ width: `${Math.max(6, pctOfTop)}%`, background: s.color }}
              >
                {pctOfTop}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
