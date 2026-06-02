"use client";

import { useStore } from "@/store/useStore";
import { BetSlip } from "./BetSlip";
import { MyBets } from "./MyBets";
import { Icon } from "./ui/Icon";

export function MobileSheet() {
  const sheet = useStore((s) => s.mobileSheet);
  const setMobileSheet = useStore((s) => s.setMobileSheet);
  if (!sheet) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 animate-fadeIn bg-black/60" onClick={() => setMobileSheet(null)} />
      <div className="absolute inset-x-0 bottom-0 max-h-[86vh] animate-slideUp overflow-y-auto rounded-t-2xl border-t border-white/10 bg-ink-850 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-pop">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink-500" />
        <button
          onClick={() => setMobileSheet(null)}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-white/5"
          aria-label="Fechar"
        >
          <Icon name="close" size={18} />
        </button>
        {sheet === "slip" ? <BetSlip /> : <MyBets />}
      </div>
    </div>
  );
}
