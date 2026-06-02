"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/store/useStore";
import { formatMoney } from "@/lib/format";
import { logout as wsLogout } from "@/lib/ws";
import { ConnectionBadge } from "./ConnectionBadge";
import { BrandLogo } from "./BrandLogo";
import { Icon } from "./ui/Icon";

const NAV = [
  { label: "Ao Vivo", href: "/", live: true },
  { label: "Esportes", href: "/" },
  { label: "Promoções", href: "/promocoes" },
];

export function TopBar() {
  const user = useStore((s) => s.user);
  const wallet = useStore((s) => s.wallet);
  const openAuth = useStore((s) => s.openAuth);
  const openWallet = useStore((s) => s.openWallet);
  const pushToast = useStore((s) => s.pushToast);
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 glass">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="transition-transform hover:scale-[1.02]">
            <BrandLogo size={32} />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const isActive = item.href === pathname;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={[
                    "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                    isActive ? "bg-white/5 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                  ].join(" ")}
                >
                  {item.live ? (
                    <span className="flex items-center gap-1.5">
                      <Icon name="live" size={15} className="text-live" />
                      {item.label}
                    </span>
                  ) : (
                    item.label
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ConnectionBadge />

          {user ? (
            <>
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-ink-800 p-1 shadow-card">
                <button
                  onClick={() => openWallet("deposit")}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1 transition hover:bg-white/5"
                >
                  <Icon name="wallet" size={18} className="shrink-0 text-brand-light" />
                  <span className="flex flex-col items-start leading-none">
                    <span className="text-[9px] font-medium uppercase tracking-wide text-slate-500">Saldo</span>
                    <span
                      data-testid="wallet-balance"
                      className="mt-1 text-sm font-bold leading-none tabular-nums text-white"
                    >
                      {wallet ? formatMoney(wallet.balance, wallet.currency) : "—"}
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => openWallet("deposit")}
                  className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-ink-950 shadow-glow transition hover:bg-brand-dark"
                >
                  Depositar
                </button>
              </div>

              <div className="relative">
                <button
                  onClick={() => setMenu((v) => !v)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-ink-600 to-ink-700 text-sm font-bold uppercase text-brand-light ring-1 ring-white/10 hover:ring-brand/40"
                  aria-label="Menu da conta"
                >
                  {user.login.slice(0, 1)}
                </button>
                {menu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                    <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-ink-800 shadow-pop animate-fadeIn">
                      <div className="border-b border-white/5 px-3 py-2.5">
                        <div className="truncate text-sm font-semibold text-white">{user.login}</div>
                        <div className="text-[11px] text-slate-500">
                          {user.role === "admin" ? "Administrador" : "Cliente BrasilBet"}
                        </div>
                      </div>
                      <Link
                        href="/perfil"
                        onClick={() => setMenu(false)}
                        className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5"
                      >
                        <Icon name="user" size={16} /> Minha conta
                      </Link>
                      {user.role === "admin" && (
                        <Link
                          href="/admin"
                          onClick={() => setMenu(false)}
                          className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5"
                        >
                          <Icon name="settings" size={16} /> Backoffice
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          wsLogout();
                          setMenu(false);
                          pushToast({ kind: "info", message: "Você saiu da conta." });
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5"
                      >
                        <Icon name="logout" size={16} /> Sair
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAuth("login")}
                className="rounded-lg border border-white/10 px-3.5 py-1.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
              >
                Entrar
              </button>
              <button
                onClick={() => openAuth("register")}
                className="rounded-lg bg-brand px-3.5 py-1.5 text-sm font-bold text-ink-950 shadow-glow transition hover:bg-brand-dark"
              >
                Cadastrar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
