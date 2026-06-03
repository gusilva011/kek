"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/store/useStore";
import { Icon, type IconName } from "../ui/Icon";
import { BannerManager } from "./BannerManager";
import { PromoManager } from "./PromoManager";
import { BrandingManager } from "./BrandingManager";
import { Dashboard } from "./Dashboard";
import { ClientsManager } from "./ClientsManager";
import { AffiliatesManager } from "./AffiliatesManager";
import { MultiplesManager } from "./MultiplesManager";

type Tab = "dashboard" | "clientes" | "afiliados" | "branding" | "banners" | "multiplas" | "promos";

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: "dashboard", label: "Dashboard", icon: "chart" },
  { key: "clientes", label: "Clientes", icon: "users" },
  { key: "afiliados", label: "Afiliados", icon: "trophy" },
  { key: "branding", label: "Marca", icon: "settings" },
  { key: "banners", label: "Banners", icon: "star" },
  { key: "multiplas", label: "Múltiplas", icon: "fire" },
  { key: "promos", label: "Promoções", icon: "ticket" },
];

export function Backoffice() {
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);
  const [tab, setTab] = useState<Tab>("dashboard");

  if (!user) {
    return (
      <Centered>
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-brand-light">
          <Icon name="lock" size={22} />
        </span>
        <h1 className="text-xl font-bold text-white">Painel administrativo</h1>
        <p className="mt-2 text-sm text-slate-400">Faça login como administrador para continuar.</p>
        <button
          onClick={() => openAuth("login")}
          className="mt-4 rounded-lg bg-brand px-5 py-2 text-sm font-bold text-ink-950 hover:bg-brand-dark"
        >
          Entrar
        </button>
        {process.env.NODE_ENV === "development" && (
          <p className="mt-4 text-xs text-slate-600">
            Admin demo — login: <b className="text-slate-400">admin</b> · senha: <b className="text-slate-400">admin123</b>
          </p>
        )}
      </Centered>
    );
  }

  if (user.role !== "admin") {
    return (
      <Centered>
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-live/15 text-live">
          <Icon name="shield" size={22} />
        </span>
        <h1 className="text-xl font-bold text-white">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-400">Esta área é exclusiva para administradores.</p>
        <Link href="/" className="mt-4 inline-block rounded-lg bg-ink-700 px-4 py-2 text-sm font-medium hover:bg-ink-600">
          Voltar ao site
        </Link>
      </Centered>
    );
  }

  const active = TABS.find((t) => t.key === tab)!;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Cabeçalho */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-ink-950 shadow-glow">
            <Icon name="chart" size={22} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold leading-none text-white">Painel administrativo</h1>
              <span className="rounded-md bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-light">
                Admin
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Visão completa de clientes, receita e operação da <b className="text-slate-300">BrasilBet</b>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-slate-400 sm:flex">
            <span className="h-2 w-2 animate-livePulse rounded-full bg-brand" /> Tempo real
          </span>
          <Link href="/" className="rounded-lg border border-ink-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-ink-800">
            ← Voltar ao site
          </Link>
        </div>
      </div>

      {/* Navegação por abas */}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-ink-600 bg-ink-850/80 p-1 no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              "flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition",
              tab === t.key ? "bg-ink-600 text-white shadow-card" : "text-slate-400 hover:bg-ink-800 hover:text-slate-200",
            ].join(" ")}
          >
            <Icon name={t.icon} size={15} className={tab === t.key ? "text-brand-light" : ""} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Título da seção ativa */}
      <div className="mb-4 flex items-center gap-2 text-slate-300">
        <Icon name={active.icon} size={16} className="text-brand-light" />
        <h2 className="text-base font-bold">{active.label}</h2>
      </div>

      {tab === "dashboard" ? (
        <Dashboard />
      ) : tab === "clientes" ? (
        <ClientsManager />
      ) : tab === "afiliados" ? (
        <AffiliatesManager />
      ) : tab === "branding" ? (
        <BrandingManager />
      ) : tab === "banners" ? (
        <BannerManager />
      ) : tab === "multiplas" ? (
        <MultiplesManager />
      ) : (
        <PromoManager />
      )}

      <p className="mt-10 text-center text-xs text-slate-600">
        BrasilBet · plataforma white-label de apostas esportivas · ambiente de demonstração
      </p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">{children}</div>;
}
