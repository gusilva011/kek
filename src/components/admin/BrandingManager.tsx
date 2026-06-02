"use client";

import { useState } from "react";
import { useStore } from "@/store/useStore";
import { adminSaveBranding } from "@/lib/ws";
import { ImageUpload } from "./ImageUpload";
import { BrandLogo } from "../BrandLogo";

const FIELD = "w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-brand";

export function BrandingManager() {
  const branding = useStore((s) => s.branding);
  const pushToast = useStore((s) => s.pushToast);
  const [name, setName] = useState(branding.brandName);
  const [logo, setLogo] = useState<string | undefined>(branding.logoDataUrl);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const ack = await adminSaveBranding({ brandName: name.trim() || "BrasilBet", logoDataUrl: logo });
    setSaving(false);
    pushToast(
      ack.ok
        ? { kind: "success", message: "Identidade da marca atualizada." }
        : { kind: "error", message: ack.message ?? "Falha ao salvar." },
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-ink-600 bg-ink-850 p-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">Pré-visualização</div>
        <div className="flex items-center gap-4 rounded-lg bg-ink-950 px-4 py-3">
          <BrandLogo size={36} override={{ brandName: name, logoDataUrl: logo }} />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-ink-600 bg-ink-800 p-4">
        <label className="block text-xs text-slate-400">
          Nome da marca
          <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} />
          <span className="mt-1 block text-[11px] text-slate-600">
            Dica: termine em "Bet" para o destaque bicolor (ex.: Brasil<b className="text-brand">Bet</b>).
          </span>
        </label>

        <div className="text-xs text-slate-400">
          Logo (envie do seu computador — PNG com fundo transparente fica melhor)
          <div className="mt-1.5">
            <ImageUpload
              value={logo}
              onChange={setLogo}
              options={{ maxW: 320, maxH: 96, type: "image/png" }}
              label="Enviar logo"
              previewClass="h-12 w-32"
            />
          </div>
          <span className="mt-1 block text-[11px] text-slate-600">
            Sem logo enviado, usamos o logo padrão BrasilBet.
          </span>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-ink-950 hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Salvar identidade"}
        </button>
      </div>

      <p className="text-center text-xs text-slate-600">
        A cor de destaque (verde) é definível por tenant no tema — personalização de cor chega num próximo passo.
      </p>
    </div>
  );
}
