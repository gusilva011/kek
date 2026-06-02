"use client";

import type { Promotion } from "@/shared/types";
import { useStore } from "@/store/useStore";

export function Promotions() {
  const promotions = useStore((s) => s.promotions);
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);
  const pushToast = useStore((s) => s.pushToast);

  const active = promotions.filter((p) => p.active);

  const onCta = () => {
    if (!user) openAuth("register");
    else pushToast({ kind: "info", message: "Promoção aplicada à sua conta (demo)." });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-white">Promoções</h1>
        <p className="mt-1 text-sm text-slate-400">
          Ofertas e bônus disponíveis na BrasilBet.
        </p>
      </div>

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-600 p-12 text-center text-slate-500">
          Nenhuma promoção ativa no momento.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {active.map((p) => (
            <PromoCard key={p.id} promo={p} onCta={onCta} />
          ))}
        </div>
      )}
    </div>
  );
}

function PromoCard({ promo, onCta }: { promo: Promotion; onCta: () => void }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-800">
      <div className="bg-gradient-to-r from-emerald-700/40 to-ink-800 p-5">
        {promo.badge && (
          <span className="mb-2 inline-block rounded-full bg-brand/20 px-2.5 py-0.5 text-[11px] font-bold text-brand-light">
            {promo.badge}
          </span>
        )}
        <h3 className="text-lg font-bold text-white">{promo.title}</h3>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5 pt-3">
        <p className="text-sm text-slate-300">{promo.description}</p>
        {promo.terms && <p className="text-xs text-slate-500">{promo.terms}</p>}
        <div className="mt-auto pt-2">
          <button
            onClick={onCta}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-ink-950 transition hover:bg-brand-dark"
          >
            {promo.ctaLabel ?? "Participar"}
          </button>
        </div>
      </div>
    </div>
  );
}
