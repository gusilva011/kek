"use client";

import { useState } from "react";
import { useStore } from "@/store/useStore";
import { deposit as wsDeposit, withdraw as wsWithdraw } from "@/lib/ws";
import { formatMoney, maskCpf } from "@/lib/format";
import { Icon } from "./ui/Icon";

const DEPOSIT_QUICK = [20, 50, 100, 200];

export function WalletModal() {
  const tab = useStore((s) => s.walletModal);
  const open = useStore((s) => s.openWallet);
  const close = useStore((s) => s.closeWallet);
  const user = useStore((s) => s.user);
  const wallet = useStore((s) => s.wallet);
  const pushToast = useStore((s) => s.pushToast);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  if (!tab) return null;

  const balance = wallet?.balance ?? 0;
  const amt = Number(amount.replace(",", "."));
  const valid = Number.isFinite(amt) && amt > 0;
  const isDeposit = tab === "deposit";
  const overBalance = !isDeposit && valid && amt > balance;

  const submit = async () => {
    if (!valid || overBalance) return;
    setLoading(true);
    const ack = isDeposit ? await wsDeposit(amt) : await wsWithdraw(amt);
    setLoading(false);
    if (ack.ok) {
      pushToast({ kind: "success", message: ack.message ?? "Concluído." });
      setAmount("");
      close();
    } else {
      pushToast({ kind: "error", message: ack.message ?? "Falha na operação." });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={close}>
      <div
        className="w-full max-w-sm animate-slideUp overflow-hidden rounded-t-2xl border border-white/10 bg-ink-850 shadow-pop sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex border-b border-white/5">
          {(["deposit", "withdraw"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                open(t);
                setAmount("");
              }}
              className={`flex-1 py-3.5 text-sm font-bold transition ${tab === t ? "bg-ink-700 text-white" : "text-slate-400 hover:text-slate-200"}`}
            >
              {t === "deposit" ? "Depositar" : "Sacar"}
            </button>
          ))}
          <button
            onClick={close}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-white/5"
            aria-label="Fechar"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Saldo atual</span>
            <span className="font-bold tabular-nums text-brand-light">{formatMoney(balance)}</span>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Valor {isDeposit ? "do depósito" : "do saque"}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                R$
              </span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-xl border border-white/5 bg-ink-900 py-2.5 pl-9 pr-3 text-right text-lg font-bold tabular-nums outline-none focus:border-brand/60"
              />
            </div>
            {isDeposit ? (
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {DEPOSIT_QUICK.map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(String(q))}
                    className="rounded-lg border border-white/5 bg-ink-700 py-1.5 text-xs font-semibold hover:border-brand/50"
                  >
                    +{q}
                  </button>
                ))}
              </div>
            ) : (
              <button
                onClick={() => setAmount(String(balance))}
                className="mt-2 text-xs font-semibold text-brand-light"
              >
                Sacar tudo ({formatMoney(balance)})
              </button>
            )}
          </div>

          {isDeposit ? (
            <div className="rounded-xl border border-white/5 bg-ink-800 p-3 text-xs text-slate-400">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-slate-300">
                <Icon name="bolt" size={14} className="text-brand-light" /> Pagamento via Pix
              </div>
              No app real aparece aqui o <b>QR Code Pix</b> gerado pelo gateway de pagamento. Nesta
              demonstração o saldo é creditado na hora.
            </div>
          ) : (
            <div className="rounded-xl border border-white/5 bg-ink-800 p-3 text-xs text-slate-400">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-slate-300">
                <Icon name="shield" size={14} className="text-brand-light" /> Saque somente para o titular
              </div>
              Pix enviado ao CPF cadastrado:{" "}
              <b className="text-slate-200">{maskCpf(user?.cpf ?? "")}</b>. Apenas o titular da conta
              pode sacar.
            </div>
          )}

          {overBalance && <p className="text-xs text-live">Valor maior que o saldo disponível.</p>}

          <button
            onClick={submit}
            disabled={!valid || overBalance || loading}
            className={`w-full rounded-xl py-3 text-sm font-bold transition ${
              valid && !overBalance ? "bg-brand text-ink-950 shadow-glow hover:bg-brand-dark" : "cursor-not-allowed bg-ink-600 text-slate-500"
            }`}
          >
            {loading ? "Processando…" : isDeposit ? "Gerar Pix e depositar" : "Solicitar saque"}
          </button>
          <p className="text-center text-[10px] text-slate-600">
            Demonstração — sem movimentação real de dinheiro. Integração com gateway (Pix) é o próximo passo.
          </p>
        </div>
      </div>
    </div>
  );
}
