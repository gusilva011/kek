"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";
import { Icon, type IconName } from "./ui/Icon";

export function MobileNav() {
  const router = useRouter();
  const pathname = usePathname();
  const slip = useStore((s) => s.slip);
  const user = useStore((s) => s.user);
  const setFilters = useStore((s) => s.setFilters);
  const setMobileSheet = useStore((s) => s.setMobileSheet);
  const openAuth = useStore((s) => s.openAuth);

  const goHome = (patch: Parameters<typeof setFilters>[0]) => {
    setFilters(patch);
    if (pathname !== "/") router.push("/");
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/5 glass lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5">
        <Item icon="football" label="Esportes" onClick={() => goHome({ status: "all", league: null })} />
        <Item icon="live" label="Ao Vivo" accent="live" onClick={() => goHome({ status: "live", league: null })} />

        {/* Bilhete em destaque (centro) */}
        <button onClick={() => setMobileSheet("slip")} className="flex flex-col items-center">
          <span className="relative -mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-ink-950 shadow-glow ring-4 ring-ink-900">
            <Icon name="ticket" size={22} />
            {slip.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-live text-[10px] font-bold text-white ring-2 ring-ink-900">
                {slip.length}
              </span>
            )}
          </span>
          <span className="mt-0.5 text-[10px] font-medium text-slate-300">Bilhete</span>
        </button>

        <Item icon="trophy" label="Apostas" onClick={() => setMobileSheet("bets")} />
        {user ? (
          <Link href="/perfil" className="flex flex-col items-center gap-0.5 py-1 text-slate-400">
            <Icon name="user" size={20} />
            <span className="text-[10px] font-medium">Conta</span>
          </Link>
        ) : (
          <Item icon="user" label="Entrar" onClick={() => openAuth("login")} />
        )}
      </div>
    </nav>
  );
}

function Item({
  icon,
  label,
  onClick,
  accent,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  accent?: "live";
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 py-1 text-slate-400 active:text-white">
      <Icon name={icon} size={20} className={accent === "live" ? "text-live" : ""} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
