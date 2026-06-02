"use client";

import Link from "next/link";
import type { Transaction, TxType } from "@/shared/types";
import { useStore } from "@/store/useStore";
import { logout as wsLogout } from "@/lib/ws";
import { formatMoney, maskCpf, formatPhone } from "@/lib/format";
import { Icon, type IconName } from "./ui/Icon";

const TX_META: Record<TxType, { label: string; icon: IconName; positive: boolean }> = {
  deposit: { label: "Depósito", icon: "wallet", positive: true },
  withdraw: { label: "Saque Pix", icon: "cashout", positive: false },
  bet: { label: "Aposta", icon: "ticket", positive: false },
  win: { label: "Prêmio", icon: "trophy", positive: true },
  cashout: { label: "Cashout", icon: "cashout", positive: true },
  bonus: { label: "Bônus", icon: "star", positive: true },
  adjust: { label: "Ajuste", icon: "settings", positive: true },
};

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Profile() {
  const user = useStore((s) => s.user);
  const wallet = useStore((s) => s.wallet);
  const transactions = useStore((s) => s.transactions);
  const openAuth = useStore((s) => s.openAuth);
  const openWallet = useStore((s) => s.openWallet);
  const pushToast = useStore((s) => s.pushToast);

  if (!user) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
        <Icon name="user" size={32} className="text-slate-600" />
        <h1 className="mt-3 text-xl font-bold text-white">Sua conta</h1>
        <p className="mt-1 text-sm text-slate-400">Entre para ver seu perfil, saldo e extrato.</p>
        <button
          onClick={() => openAuth("login")}
          className="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-ink-950 shadow-glow hover:bg-brand-dark"
        >
          Entrar
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-ink-600 to-ink-700 text-lg font-bold uppercase text-brand-light ring-1 ring-white/10">
          {user.login.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold text-white">{user.name || user.login}</h1>
          <p className="truncate text-xs text-slate-500">
            @{user.login} · {user.role === "admin" ? "Administrador" : "Cliente"}
          </p>
        </div>
        <button
          onClick={() => {
            wsLogout();
            pushToast({ kind: "info", message: "Você saiu da conta." });
          }}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
        >
          <Icon name="logout" size={15} /> Sair
        </button>
      </div>

      {/* Carteira */}
      <div className="mb-4 rounded-2xl border border-white/5 bg-gradient-to-br from-ink-700/70 to-ink-800 p-5 shadow-card">
        <div className="text-xs uppercase tracking-wide text-slate-500">Saldo disponível</div>
        <div className="mt-1 text-3xl font-extrabold tabular-nums text-brand-light">
          {formatMoney(wallet?.balance ?? 0)}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => openWallet("deposit")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-sm font-bold text-ink-950 shadow-glow hover:bg-brand-dark"
          >
            <Icon name="wallet" size={16} /> Depositar
          </button>
          <button
            onClick={() => openWallet("withdraw")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2.5 text-sm font-bold text-white hover:bg-white/5"
          >
            <Icon name="cashout" size={16} /> Sacar
          </button>
        </div>
      </div>

      {/* Indique e ganhe */}
      <Link
        href="/afiliados"
        className="mb-4 flex items-center gap-3 rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/10 to-transparent p-4 transition hover:border-brand/50"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/15 text-brand-light">
          <Icon name="users" size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white">Indique e Ganhe</div>
          <div className="text-xs text-slate-400">Convide amigos e receba comissão das apostas deles.</div>
        </div>
        <Icon name="chevronRight" size={18} className="text-slate-500" />
      </Link>

      {/* Dados */}
      <div className="mb-4 rounded-2xl border border-white/5 bg-ink-800/80 p-5 shadow-card">
        <h2 className="mb-3 text-sm font-bold text-white">Dados da conta</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Info label="E-mail" value={user.email || "—"} />
          <Info label="CPF" value={maskCpf(user.cpf)} />
          <Info label="Telefone" value={user.phone ? formatPhone(user.phone) : "—"} />
          <Info label="Conta criada" value={new Date(user.createdAt).toLocaleDateString("pt-BR")} />
        </dl>
        <p className="mt-3 text-[11px] text-slate-600">
          O CPF é usado para garantir que saques sejam feitos somente para o titular.
        </p>
      </div>

      {/* Extrato */}
      <div className="rounded-2xl border border-white/5 bg-ink-800/80 p-5 shadow-card">
        <h2 className="mb-3 text-sm font-bold text-white">Extrato</h2>
        {transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nenhuma movimentação ainda.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {transactions.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-semibold text-slate-200">{value}</dd>
    </div>
  );
}

function TxRow({ tx }: { tx: Transaction }) {
  const meta = TX_META[tx.type];
  const pending = tx.status === "pending";
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          meta.positive ? "bg-brand/15 text-brand-light" : "bg-ink-700 text-slate-400"
        }`}
      >
        <Icon name={meta.icon} size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-200">{meta.label}</div>
        <div className="truncate text-[11px] text-slate-500">
          {fmtDate(tx.at)}
          {tx.description ? ` · ${tx.description}` : ""}
          {pending && <span className="ml-1 text-amber-400">· em processamento</span>}
        </div>
      </div>
      <div className={`shrink-0 text-sm font-bold tabular-nums ${meta.positive ? "text-brand-light" : "text-slate-300"}`}>
        {tx.amount >= 0 ? "+" : "-"} {formatMoney(Math.abs(tx.amount))}
      </div>
    </div>
  );
}
