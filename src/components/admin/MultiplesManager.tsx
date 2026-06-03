"use client";

import { useMemo, useState } from "react";
import type { Match, MultipleLeg, PopularMultiple, PopularMultipleInput } from "@/shared/types";
import { useStore } from "@/store/useStore";
import { adminSaveMultiple, adminDeleteMultiple } from "@/lib/ws";
import { ptTeam, ptLeague } from "@/lib/i18n";
import { formatOdds } from "@/lib/format";
import { Icon } from "../ui/Icon";

const FIELD = "w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-brand";

function emptyMultiple(order: number): PopularMultipleInput {
  return { title: "", popularity: 500, active: true, order, legs: [] };
}

export function MultiplesManager() {
  const multiples = useStore((s) => s.popularMultiples);
  const matches = useStore((s) => s.matches);
  const pushToast = useStore((s) => s.pushToast);

  const [editing, setEditing] = useState<PopularMultipleInput | null>(null);
  const [saving, setSaving] = useState(false);

  // Construtor de perna.
  const [search, setSearch] = useState("");
  const [pickMatchId, setPickMatchId] = useState<string | null>(null);
  const [marketKey, setMarketKey] = useState<string>("");
  const [selectionId, setSelectionId] = useState<string>("");

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return Object.values(matches)
      .filter((m) => m.status !== "finished")
      .filter((m) => `${m.home} ${m.away} ${m.league}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, matches]);

  const pickMatch = pickMatchId ? matches[pickMatchId] : null;
  const pickMarket = pickMatch?.markets.find((mk) => mk.key === marketKey) ?? pickMatch?.markets[0];
  const pickSelection = pickMarket?.selections.find((s) => s.id === selectionId);

  const selectMatch = (m: Match) => {
    setPickMatchId(m.id);
    const mk = m.markets.find((x) => x.key === "1x2") ?? m.markets[0];
    setMarketKey(mk?.key ?? "");
    setSelectionId(mk?.selections[0]?.id ?? "");
    setSearch("");
  };

  const addLeg = () => {
    if (!editing || !pickMatch || !pickMarket || !pickSelection) return;
    if (editing.legs.some((l) => l.matchId === pickMatch.id)) {
      pushToast({ kind: "error", message: "Esse jogo já está na múltipla." });
      return;
    }
    const leg: MultipleLeg = {
      matchId: pickMatch.id,
      marketKey: pickMarket.key,
      selectionId: pickSelection.id,
      matchLabel: `${pickMatch.home} x ${pickMatch.away}`,
      league: pickMatch.league,
      marketName: pickMarket.name,
      selectionLabel: pickSelection.label,
      oddsAtPick: pickSelection.odds,
    };
    setEditing({ ...editing, legs: [...editing.legs, leg] });
    setPickMatchId(null);
    setMarketKey("");
    setSelectionId("");
  };

  const removeLeg = (id: string) =>
    editing && setEditing({ ...editing, legs: editing.legs.filter((l) => l.selectionId !== id) });

  const save = async () => {
    if (!editing) return;
    if (editing.legs.length < 2) {
      pushToast({ kind: "error", message: "A múltipla precisa de ao menos 2 seleções." });
      return;
    }
    setSaving(true);
    const ack = await adminSaveMultiple(editing);
    setSaving(false);
    if (ack.ok) {
      pushToast({ kind: "success", message: "Múltipla salva." });
      setEditing(null);
    } else {
      pushToast({ kind: "error", message: ack.message ?? "Falha ao salvar." });
    }
  };

  const remove = async (m: PopularMultiple) => {
    const ack = await adminDeleteMultiple(m.id);
    pushToast(
      ack.ok
        ? { kind: "success", message: "Múltipla removida." }
        : { kind: "error", message: ack.message ?? "Falha ao remover." },
    );
  };

  const toggle = (m: PopularMultiple) => adminSaveMultiple({ ...m, active: !m.active });

  const combined = editing ? editing.legs.reduce((a, l) => a * l.oddsAtPick, 1) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {multiples.length} múltipla(s) · {multiples.some((m) => m.active) ? "exibindo as ativas na home" : "nenhuma ativa — a home gera automáticas"}
        </p>
        <button
          onClick={() => setEditing(emptyMultiple(multiples.length))}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-ink-950 hover:bg-brand-dark"
        >
          + Nova múltipla
        </button>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {multiples.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-lg border border-ink-600 bg-ink-800 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-gold/15 text-gold">
              <Icon name="fire" size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">
                {m.title?.trim() || `Múltipla de ${m.legs.length} seleções`}
              </div>
              <div className="truncate text-xs text-slate-500">
                {m.popularity}+ apostas · {m.legs.length} seleções · @{" "}
                {m.legs.reduce((a, l) => a * l.oddsAtPick, 1).toFixed(2)}
              </div>
            </div>
            <button
              onClick={() => toggle(m)}
              className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${
                m.active ? "bg-brand/15 text-brand-light" : "bg-ink-700 text-slate-500"
              }`}
            >
              {m.active ? "Ativa" : "Inativa"}
            </button>
            <button
              onClick={() => setEditing({ ...m, legs: [...m.legs] })}
              className="shrink-0 rounded px-2 py-1 text-xs text-slate-300 hover:bg-ink-700"
            >
              Editar
            </button>
            <button
              onClick={() => remove(m)}
              className="shrink-0 rounded px-2 py-1 text-xs text-live hover:bg-live/10"
            >
              Excluir
            </button>
          </div>
        ))}
        {multiples.length === 0 && (
          <p className="rounded-lg border border-dashed border-ink-600 px-4 py-6 text-center text-sm text-slate-500">
            Nenhuma múltipla configurada. Sem nenhuma ativa, a home monta múltiplas automáticas com os jogos do momento.
          </p>
        )}
      </div>

      {/* Editor */}
      {editing && (
        <div className="space-y-3 rounded-xl border border-ink-600 bg-ink-850 p-4">
          <h3 className="text-sm font-bold text-white">{editing.id ? "Editar múltipla" : "Nova múltipla"}</h3>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-slate-400">
              Título (opcional)
              <input
                className={`${FIELD} mt-1`}
                placeholder="Ex.: Múltipla do dia"
                value={editing.title ?? ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </label>
            <label className="block text-xs text-slate-400">
              “Apostas feitas” (popularidade)
              <input
                type="number"
                className={`${FIELD} mt-1`}
                value={editing.popularity}
                min={0}
                onChange={(e) => setEditing({ ...editing, popularity: Number(e.target.value) || 0 })}
              />
            </label>
          </div>

          {/* Pernas atuais */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
              <span>Seleções ({editing.legs.length})</span>
              {editing.legs.length >= 2 && (
                <span className="font-bold text-brand-light">Odds totais @ {combined.toFixed(2)}</span>
              )}
            </div>
            <div className="space-y-1.5">
              {editing.legs.map((l) => {
                const live = matches[l.matchId];
                const liveSel = live?.markets
                  .find((mk) => mk.key === l.marketKey)
                  ?.selections.find((s) => s.id === l.selectionId);
                return (
                  <div key={l.selectionId} className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">
                        {ptTeam(l.selectionLabel)}
                        <span className="ml-1.5 text-[11px] font-normal text-slate-500">{l.marketName}</span>
                      </div>
                      <div className="truncate text-[11px] text-slate-500">
                        {ptTeam(l.matchLabel.split(" x ")[0])} - {ptTeam(l.matchLabel.split(" x ")[1] ?? "")} ·{" "}
                        {ptLeague(l.league)}
                      </div>
                    </div>
                    {!live && <span className="shrink-0 text-[10px] font-semibold text-amber-400">indisponível</span>}
                    <span className="shrink-0 text-sm font-bold tabular-nums text-white">
                      {formatOdds(liveSel?.odds ?? l.oddsAtPick)}
                    </span>
                    <button
                      onClick={() => removeLeg(l.selectionId)}
                      className="shrink-0 rounded p-1 text-slate-500 hover:bg-live/10 hover:text-live"
                      aria-label="Remover seleção"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                );
              })}
              {editing.legs.length === 0 && (
                <p className="rounded-lg border border-dashed border-ink-600 px-3 py-3 text-center text-xs text-slate-500">
                  Adicione seleções buscando os jogos abaixo.
                </p>
              )}
            </div>
          </div>

          {/* Construtor de perna */}
          <div className="space-y-2 rounded-lg border border-ink-600 bg-ink-900/60 p-3">
            <div className="text-xs font-semibold text-slate-300">Adicionar seleção</div>
            <input
              className={FIELD}
              placeholder="Buscar jogo (time ou liga)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {results.length > 0 && (
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {results.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => selectMatch(m)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-left text-sm hover:border-brand/50"
                  >
                    <span className="min-w-0 truncate text-slate-200">
                      {ptTeam(m.home)} <span className="text-slate-600">x</span> {ptTeam(m.away)}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-500">{ptLeague(m.league)}</span>
                  </button>
                ))}
              </div>
            )}

            {pickMatch && pickMarket && (
              <div className="space-y-2 rounded-lg border border-ink-600 bg-ink-850 p-2.5">
                <div className="text-xs font-semibold text-white">
                  {ptTeam(pickMatch.home)} x {ptTeam(pickMatch.away)}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-[11px] text-slate-400">
                    Mercado
                    <select
                      className={`${FIELD} mt-1`}
                      value={pickMarket.key}
                      onChange={(e) => {
                        setMarketKey(e.target.value);
                        const mk = pickMatch.markets.find((x) => x.key === e.target.value);
                        setSelectionId(mk?.selections[0]?.id ?? "");
                      }}
                    >
                      {pickMatch.markets.map((mk) => (
                        <option key={mk.key} value={mk.key}>
                          {mk.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[11px] text-slate-400">
                    Seleção
                    <select
                      className={`${FIELD} mt-1`}
                      value={selectionId}
                      onChange={(e) => setSelectionId(e.target.value)}
                    >
                      {pickMarket.selections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {ptTeam(s.label)} ({formatOdds(s.odds)})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  onClick={addLeg}
                  disabled={!pickSelection}
                  className="w-full rounded-lg bg-brand px-3 py-2 text-sm font-bold text-ink-950 hover:bg-brand-dark disabled:opacity-50"
                >
                  + Adicionar seleção {pickSelection ? `(${formatOdds(pickSelection.odds)})` : ""}
                </button>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={editing.active}
              onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
            />
            Ativa (exibir na home)
          </label>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-ink-950 hover:bg-brand-dark disabled:opacity-60"
            >
              {saving ? "Salvando…" : "Salvar múltipla"}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="rounded-lg bg-ink-600 px-4 py-2 text-sm font-medium hover:bg-ink-550"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
