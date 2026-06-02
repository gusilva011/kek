"use client";

import { useStore } from "@/store/useStore";

const MAP = {
  open: { dot: "bg-emerald-500", label: "Ao vivo" },
  connecting: { dot: "bg-amber-500 animate-pulse", label: "Conectando" },
  closed: { dot: "bg-red-500", label: "Offline" },
} as const;

export function ConnectionBadge() {
  const conn = useStore((s) => s.conn);
  const m = MAP[conn];
  return (
    <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
      <span className={`h-2 w-2 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}
