"use client";

/** Barra fina de progresso do jogo ao vivo (minuto / 90). */
export function LiveProgress({ minute, className = "" }: { minute: number; className?: string }) {
  const pct = Math.max(2, Math.min(100, Math.round((minute / 90) * 100)));
  return (
    <div className={`h-1 w-full overflow-hidden rounded-full bg-ink-600 ${className}`}>
      <div className="h-full rounded-full bg-live transition-all duration-700" style={{ width: `${pct}%` }} />
    </div>
  );
}
