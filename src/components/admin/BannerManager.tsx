"use client";

import { useState } from "react";
import type { Banner, BannerInput } from "@/shared/types";
import { useStore } from "@/store/useStore";
import { adminSaveBanner, adminDeleteBanner } from "@/lib/ws";
import { ImageUpload } from "./ImageUpload";

const GRADIENTS = [
  { label: "Verde", value: "from-emerald-600 to-emerald-900" },
  { label: "Azul", value: "from-sky-700 to-indigo-900" },
  { label: "Laranja", value: "from-amber-500 to-orange-700" },
  { label: "Vermelho", value: "from-rose-600 to-red-900" },
  { label: "Roxo", value: "from-violet-600 to-fuchsia-900" },
  { label: "Cinza", value: "from-slate-700 to-slate-900" },
  { label: "Brasil", value: "from-green-600 to-yellow-600" },
];

const FIELD = "w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-brand";

function emptyBanner(order: number): BannerInput {
  return {
    title: "",
    subtitle: "",
    bg: GRADIENTS[0].value,
    ctaLabel: "",
    ctaHref: "",
    active: true,
    order,
  };
}

export function BannerManager() {
  const banners = useStore((s) => s.banners);
  const pushToast = useStore((s) => s.pushToast);
  const [editing, setEditing] = useState<BannerInput | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim()) {
      pushToast({ kind: "error", message: "Informe um título para o banner." });
      return;
    }
    setSaving(true);
    const ack = await adminSaveBanner(editing);
    setSaving(false);
    if (ack.ok) {
      pushToast({ kind: "success", message: "Banner salvo." });
      setEditing(null);
    } else {
      pushToast({ kind: "error", message: ack.message ?? "Falha ao salvar." });
    }
  };

  const remove = async (b: Banner) => {
    const ack = await adminDeleteBanner(b.id);
    pushToast(
      ack.ok
        ? { kind: "success", message: "Banner removido." }
        : { kind: "error", message: ack.message ?? "Falha ao remover." },
    );
  };

  const toggle = (b: Banner) => adminSaveBanner({ ...b, active: !b.active });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{banners.length} banner(s) cadastrado(s)</p>
        <button
          onClick={() => setEditing(emptyBanner(banners.length))}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-ink-950 hover:bg-brand-dark"
        >
          + Novo banner
        </button>
      </div>

      <div className="space-y-2">
        {banners.map((b) => (
          <div key={b.id} className="flex items-center gap-3 rounded-lg border border-ink-600 bg-ink-800 p-3">
            <div className={`h-10 w-16 shrink-0 rounded bg-gradient-to-r ${b.bg}`} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{b.title}</div>
              <div className="truncate text-xs text-slate-500">{b.subtitle}</div>
            </div>
            <button
              onClick={() => toggle(b)}
              className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${
                b.active ? "bg-brand/15 text-brand-light" : "bg-ink-700 text-slate-500"
              }`}
            >
              {b.active ? "Ativo" : "Inativo"}
            </button>
            <button
              onClick={() => setEditing({ ...b })}
              className="shrink-0 rounded px-2 py-1 text-xs text-slate-300 hover:bg-ink-700"
            >
              Editar
            </button>
            <button
              onClick={() => remove(b)}
              className="shrink-0 rounded px-2 py-1 text-xs text-live hover:bg-live/10"
            >
              Excluir
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="space-y-3 rounded-xl border border-ink-600 bg-ink-850 p-4">
          <h3 className="text-sm font-bold text-white">{editing.id ? "Editar banner" : "Novo banner"}</h3>
          <input
            className={FIELD}
            placeholder="Título"
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
          />
          <input
            className={FIELD}
            placeholder="Subtítulo"
            value={editing.subtitle}
            onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
          />
          <label className="block text-xs text-slate-400">
            Cor de fundo (usada quando não há imagem)
            <select
              className={FIELD}
              value={editing.bg}
              onChange={(e) => setEditing({ ...editing, bg: e.target.value })}
            >
              {GRADIENTS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs text-slate-400">
            Imagem do banner (opcional — enviada do seu computador)
            <div className="mt-1.5">
              <ImageUpload
                value={editing.imageUrl}
                onChange={(v) => setEditing({ ...editing, imageUrl: v })}
                options={{ maxW: 1280, maxH: 640, type: "image/jpeg", quality: 0.82 }}
                previewClass="h-16 w-28"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              className={FIELD}
              placeholder="Texto do botão (ex.: Criar conta)"
              value={editing.ctaLabel ?? ""}
              onChange={(e) => setEditing({ ...editing, ctaLabel: e.target.value })}
            />
            <input
              className={FIELD}
              placeholder="Link (#cadastro, #jogos, https://…)"
              value={editing.ctaHref ?? ""}
              onChange={(e) => setEditing({ ...editing, ctaHref: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={editing.active}
              onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
            />
            Ativo
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
