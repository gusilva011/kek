"use client";

import { useEffect } from "react";
import { useStore, type Toast } from "@/store/useStore";

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[90vw] flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} dismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({ t, dismiss }: { t: Toast; dismiss: (id: string) => void }) {
  useEffect(() => {
    const x = setTimeout(() => dismiss(t.id), 4000);
    return () => clearTimeout(x);
  }, [t.id, dismiss]);

  const cls =
    t.kind === "success"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : t.kind === "error"
        ? "border-red-500/40 bg-red-500/10 text-red-200"
        : "border-ink-500 bg-ink-700 text-slate-200";

  return (
    <div
      onClick={() => dismiss(t.id)}
      className={`cursor-pointer rounded-lg border px-3 py-2 text-sm shadow-lg ${cls}`}
    >
      {t.message}
    </div>
  );
}
