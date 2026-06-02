"use client";

import { useState } from "react";
import type { Promotion, PromotionInput } from "@/shared/types";
import { useStore } from "@/store/useStore";
import { adminSavePromo, adminDeletePromo } from "@/lib/ws";

const FIELD = "w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-brand";

function emptyPromo(): PromotionInput {
  return { title: "", description: "", badge: "", terms: "", ctaLabel: "", active: true };
}

export function PromoManager() {
  const promotions = useStore((s) => s.promotions);
  const pushToast = useStore((s) => s.pushToast);
  const [editing, setEditing] = useState<PromotionInput | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim()) {
      pushToast({ kind: "error", message: "Informe um título para a promoção." });
      return;
    }
    setSaving(true);
    const ack = await adminSavePromo(editing);
    setSaving(false);
    if (ack.ok) {
      pushToast({ kind: "success", message: "Promoção salva." });
      setEditing(null);
    } else {
      pushToast({ kind: "error", message: ack.message ?? "Falha ao salvar." });
    }
  };

  const remove = async (p: Promotion) => {
    const ack = await adminDeletePromo(p.id);
    pushToast(
      ack.ok
        ? { kind: "success", message: "Promoção removida." }
        : { kind: "error", message: ack.message ?? "Falha ao remover." },
    );
  };

  const toggle = (p: Promotion) =>
    adminSavePromo({
      id: p.id,
      title: p.title,
      description: p.description,
      badge: p.badge,
      terms: p.terms,
      ctaLabel: p.ctaLabel,
      active: !p.active,
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{promotions.length} promoção(ões) cadastrada(s)</p>
        <button
          onClick={() => setEditing(emptyPromo())}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-ink-950 hover:bg-brand-dark"
        >
          + Nova promoção
        </button>
      </div>

      <div className="space-y-2">
        {promotions.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border border-ink-600 bg-ink-800 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-white">{p.title}</span>
                {p.badge && (
                  <span className="shrink-0 rounded-full bg-brand/20 px-2 text-[10px] font-bold text-brand-light">
                    {p.badge}
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-slate-500">{p.description}</div>
            </div>
            <button
              onClick={() => toggle(p)}
              className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${
                p.active ? "bg-brand/15 text-brand-light" : "bg-ink-700 text-slate-500"
              }`}
            >
              {p.active ? "Ativa" : "Inativa"}
            </button>
            <button
              onClick={() => setEditing({ ...p })}
              className="shrink-0 rounded px-2 py-1 text-xs text-slate-300 hover:bg-ink-700"
            >
              Editar
            </button>
            <button
              onClick={() => remove(p)}
              className="shrink-0 rounded px-2 py-1 text-xs text-live hover:bg-live/10"
            >
              Excluir
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="space-y-3 rounded-xl border border-ink-600 bg-ink-850 p-4">
          <h3 className="text-sm font-bold text-white">{editing.id ? "Editar promoção" : "Nova promoção"}</h3>
          <input
            className={FIELD}
            placeholder="Título"
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
          />
          <textarea
            className={`${FIELD} min-h-[72px] resize-y`}
            placeholder="Descrição"
            value={editing.description}
            onChange={(e) => setEditing({ ...editing, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className={FIELD}
              placeholder="Selo (ex.: Novo cliente)"
              value={editing.badge ?? ""}
              onChange={(e) => setEditing({ ...editing, badge: e.target.value })}
            />
            <input
              className={FIELD}
              placeholder="Texto do botão"
              value={editing.ctaLabel ?? ""}
              onChange={(e) => setEditing({ ...editing, ctaLabel: e.target.value })}
            />
          </div>
          <input
            className={FIELD}
            placeholder="Termos / regras (opcional)"
            value={editing.terms ?? ""}
            onChange={(e) => setEditing({ ...editing, terms: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={editing.active}
              onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
            />
            Ativa
          </label>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-ink-950 hover:bg-brand-dark disabled:opacity-60"
            >
              {saving ? "Salvando…" : "Salvar"}
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
