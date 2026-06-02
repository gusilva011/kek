"use client";

import { useRef, useState } from "react";
import { fileToDataUrl, type ImageOptions } from "@/lib/image";
import { useStore } from "@/store/useStore";

/** Botão de upload de imagem do computador → data URL compactada, com preview. */
export function ImageUpload({
  value,
  onChange,
  options,
  label = "Enviar imagem",
  previewClass = "h-14 w-24",
  rounded = "rounded-md",
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
  options?: ImageOptions;
  label?: string;
  previewClass?: string;
  rounded?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pushToast = useStore((s) => s.pushToast);
  const [busy, setBusy] = useState(false);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      onChange(await fileToDataUrl(file, options));
    } catch (err) {
      pushToast({ kind: "error", message: err instanceof Error ? err.message : "Falha ao processar imagem." });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden border border-ink-600 bg-ink-900 ${previewClass} ${rounded}`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="px-1 text-center text-[10px] text-slate-600">sem imagem</span>
        )}
      </div>
      <div className="flex flex-col items-start gap-1">
        <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-lg border border-ink-600 bg-ink-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-brand/60 disabled:opacity-60"
        >
          {busy ? "Processando…" : `📁 ${label}`}
        </button>
        {value && (
          <button type="button" onClick={() => onChange(undefined)} className="text-[11px] text-live hover:underline">
            Remover imagem
          </button>
        )}
      </div>
    </div>
  );
}
