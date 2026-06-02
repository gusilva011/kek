"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { login as wsLogin, register as wsRegister } from "@/lib/ws";
import { BrandLogo } from "./BrandLogo";
import { Icon } from "./ui/Icon";
import { formatCpf, formatPhone } from "@/lib/format";

/** Força da senha (0–4) para o medidor visual. */
function passwordScore(pw: string): number {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}
const STRENGTH = [
  { label: "muito fraca", color: "#ef4444" },
  { label: "fraca", color: "#f59e0b" },
  { label: "razoável", color: "#eab308" },
  { label: "boa", color: "#84cc16" },
  { label: "forte", color: "#15cb80" },
];

export function AuthModal() {
  const open = useStore((s) => s.authOpen);
  const mode = useStore((s) => s.authMode);
  const closeAuth = useStore((s) => s.closeAuth);
  const pushToast = useStore((s) => s.pushToast);

  const [tab, setTab] = useState<"login" | "register">(mode);
  const [loginName, setLoginName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(mode);
      setError(null);
    }
  }, [open, mode]);

  const score = useMemo(() => passwordScore(password), [password]);

  if (!open) return null;

  const submit = async () => {
    setError(null);
    if (tab === "register" && password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    const ack =
      tab === "login"
        ? await wsLogin(loginName.trim(), password)
        : await wsRegister({
            login: loginName.trim(),
            password,
            name: name.trim(),
            email: email.trim(),
            phone,
            cpf,
            birthDate,
          });
    setLoading(false);
    if (ack.ok) {
      pushToast({
        kind: "success",
        message: tab === "login" ? "Bem-vindo de volta!" : "Conta criada! Você ganhou R$ 1.000 de bônus.",
      });
      setPassword("");
      setConfirm("");
      closeAuth();
    } else {
      setError(ack.message ?? "Não foi possível continuar.");
    }
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={closeAuth}>
      <div
        className="flex max-h-[92vh] w-full max-w-sm animate-slideUp flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-ink-850 shadow-pop sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex shrink-0 flex-col items-center gap-1 border-b border-white/5 bg-gradient-to-b from-ink-800 to-ink-850 px-5 py-5">
          <BrandLogo size={32} />
          <p className="text-xs text-slate-400">
            {tab === "login" ? "Acesse sua conta" : "Crie sua conta em 1 minuto"}
          </p>
          <button
            onClick={closeAuth}
            className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-white"
            aria-label="Fechar"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="flex shrink-0 border-b border-white/5">
          {(["login", "register"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setError(null);
              }}
              className={[
                "flex-1 py-3 text-sm font-bold transition",
                tab === t ? "bg-ink-700 text-white" : "text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              {t === "login" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>

        <div className="space-y-3 overflow-y-auto p-5">
          {tab === "register" && (
            <Field label="Nome completo" icon="user">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={onEnter}
                placeholder="Seu nome e sobrenome"
                autoFocus
                className="auth-input"
              />
            </Field>
          )}

          <Field label="Login" icon="user">
            <input
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              onKeyDown={onEnter}
              placeholder="seu_usuario"
              autoFocus={tab === "login"}
              className="auth-input"
            />
          </Field>

          {tab === "register" && (
            <>
              <Field label="E-mail" icon="mail">
                <input
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={onEnter}
                  placeholder="voce@email.com"
                  className="auth-input"
                />
              </Field>
              <Field label="CPF" icon="shield" hint="Saques só p/ o titular">
                <input
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  onKeyDown={onEnter}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="auth-input"
                />
              </Field>
              <Field label="Telefone (WhatsApp)" icon="bell">
                <input
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  onKeyDown={onEnter}
                  placeholder="(11) 99999-9999"
                  maxLength={16}
                  className="auth-input"
                />
              </Field>
              <Field label="Data de nascimento" icon="calendar" hint="+18 obrigatório">
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  onKeyDown={onEnter}
                  max="2009-12-31"
                  className="auth-input"
                />
              </Field>
            </>
          )}

          <Field label="Senha" icon="lock">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onEnter}
              placeholder="••••••"
              className="auth-input"
            />
          </Field>

          {tab === "register" && password.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex h-1.5 flex-1 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full transition-colors"
                    style={{ background: i < score ? STRENGTH[score].color : "#1e2838" }}
                  />
                ))}
              </div>
              <span className="w-20 text-right text-[10px] text-slate-500">Senha {STRENGTH[score].label}</span>
            </div>
          )}

          {tab === "register" && (
            <Field label="Confirmar senha" icon="lock">
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={onEnter}
                placeholder="••••••"
                className="auth-input"
              />
            </Field>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-live/40 bg-live/10 px-3 py-2 text-sm text-live">
              <Icon name="info" size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="mt-1 w-full rounded-xl bg-brand py-3 text-base font-bold text-ink-950 shadow-glow transition hover:bg-brand-dark disabled:opacity-60"
          >
            {loading ? "Aguarde…" : tab === "login" ? "Entrar" : "Criar conta e ganhar R$ 1.000"}
          </button>

          {tab === "register" && (
            <p className="text-center text-[11px] leading-relaxed text-slate-500">
              Ao criar conta você concorda com os termos. Plataforma demonstrativa, +18. Jogue com responsabilidade.
            </p>
          )}
          {tab === "login" && (
            <p className="text-center text-[11px] text-slate-500">
              Não tem conta?{" "}
              <button onClick={() => setTab("register")} className="font-semibold text-brand-light">
                Cadastre-se grátis
              </button>
            </p>
          )}
        </div>
      </div>

      <style jsx global>{`
        .auth-input {
          width: 100%;
          border-radius: 0.6rem;
          border: 1px solid #1e2838;
          background: #0a0e15;
          padding: 0.7rem 0.9rem;
          font-size: 1rem;
          color: #e2e8f0;
          outline: none;
          color-scheme: dark;
          transition: border-color 0.15s ease;
        }
        .auth-input:focus {
          border-color: #15cb80;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <Icon name={icon} size={13} />
        {label}
        {hint && <span className="ml-auto text-[10px] font-normal text-slate-600">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
