"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { login as wsLogin, register as wsRegister, checkAvailability } from "@/lib/ws";
import { BrandLogo } from "./BrandLogo";
import { Icon } from "./ui/Icon";
import type { IconName } from "./ui/Icon";
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

/* --- Validações puras (espelham o servidor; sem dependências de node) --- */
function isValidCpf(cpf: string): boolean {
  const c = (cpf ?? "").replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(c[i], 10) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(c[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(c[i], 10) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(c[10], 10);
}
function ageFrom(birthDate: string): number {
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return NaN;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((e ?? "").trim());
const phoneDigits = (p: string) => (p ?? "").replace(/\D/g, "");

type AvailStatus = "idle" | "checking" | "available" | "taken";

/**
 * Checa em tempo real (com debounce) se um campo está disponível no servidor.
 * Só consulta quando `ready` (campo com formato válido), evitando requisições
 * a cada tecla. Retorna o status para o indicador visual.
 */
function useFieldAvailability(
  field: "login" | "cpf" | "email",
  value: string,
  ready: boolean,
): AvailStatus {
  const [status, setStatus] = useState<AvailStatus>("idle");
  useEffect(() => {
    if (!ready || !value) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await checkAvailability({ [field]: value });
      if (cancelled) return;
      setStatus(res[field] === false ? "taken" : res[field] === true ? "available" : "idle");
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [field, value, ready]);
  return status;
}

/** Etapas do cadastro (padrão Superbet: identidade → contato → acesso). */
const STEPS = [
  { n: 1, title: "Seus dados", subtitle: "Confirme sua identidade" },
  { n: 2, title: "Contato", subtitle: "Como falamos com você" },
  { n: 3, title: "Acesso", subtitle: "Crie seu login e senha" },
];
const TOTAL = STEPS.length;

export function AuthModal() {
  const open = useStore((s) => s.authOpen);
  const mode = useStore((s) => s.authMode);
  const closeAuth = useStore((s) => s.closeAuth);
  const pushToast = useStore((s) => s.pushToast);

  const [tab, setTab] = useState<"login" | "register">(mode);
  const [step, setStep] = useState(1);
  const [loginName, setLoginName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [refCode, setRefCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(mode);
      setStep(1);
      setError(null);
      // Pré-preenche o código de indicação vindo do link ?ref= (afiliado).
      try {
        const stored = localStorage.getItem("brasilbet_ref");
        if (stored) setRefCode(stored);
      } catch {
        /* ignore */
      }
    }
  }, [open, mode]);

  const score = useMemo(() => passwordScore(password), [password]);

  // Checagem de disponibilidade em tempo real (só no cadastro).
  const isReg = tab === "register";
  const loginValid =
    loginName.trim().length >= 3 && /^[a-zA-Z0-9_.]+$/.test(loginName.trim());
  const loginStatus = useFieldAvailability("login", loginName.trim(), isReg && loginValid);
  const cpfStatus = useFieldAvailability("cpf", cpf, isReg && isValidCpf(cpf));
  const emailStatus = useFieldAvailability("email", email.trim(), isReg && isValidEmail(email));

  if (!open) return null;

  /** Valida a etapa atual; retorna msg de erro ou null. */
  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!name.trim() || name.trim().length < 3 || !name.trim().includes(" "))
        return "Informe seu nome completo (nome e sobrenome).";
      if (!isValidCpf(cpf)) return "CPF inválido. Confira os números.";
      if (cpfStatus === "taken") return "Já existe uma conta com este CPF.";
      const age = ageFrom(birthDate);
      if (Number.isNaN(age)) return "Informe sua data de nascimento.";
      if (age < 18) return "É necessário ter 18 anos ou mais.";
      if (age > 120) return "Data de nascimento inválida.";
    }
    if (s === 2) {
      if (!isValidEmail(email)) return "E-mail inválido.";
      if (emailStatus === "taken") return "Já existe uma conta com este e-mail.";
      const d = phoneDigits(phone);
      if (d.length < 10 || d.length > 11) return "Telefone inválido (DDD + número).";
    }
    if (s === 3) {
      if (loginName.trim().length < 3) return "O login deve ter ao menos 3 caracteres.";
      if (!/^[a-zA-Z0-9_.]+$/.test(loginName.trim()))
        return "Login: use apenas letras, números, ponto ou _.";
      if (loginStatus === "taken") return "Este login já está em uso.";
      if (password.length < 6) return "A senha deve ter ao menos 6 caracteres.";
      if (password !== confirm) return "As senhas não conferem.";
      if (!acceptedTerms) return "Você precisa aceitar os termos para continuar.";
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (step < TOTAL) setStep(step + 1);
    else void submitRegister();
  };

  const back = () => {
    setError(null);
    if (step > 1) setStep(step - 1);
  };

  const submitRegister = async () => {
    setLoading(true);
    const ack = await wsRegister({
      login: loginName.trim(),
      password,
      name: name.trim(),
      email: email.trim(),
      phone,
      cpf,
      birthDate,
      ref: refCode.trim() || undefined,
    });
    setLoading(false);
    if (ack.ok) {
      pushToast({ kind: "success", message: "Conta criada! Você ganhou R$ 1.000 de bônus." });
      setPassword("");
      setConfirm("");
      closeAuth();
    } else {
      setError(ack.message ?? "Não foi possível continuar.");
    }
  };

  const submitLogin = async () => {
    setError(null);
    setLoading(true);
    const ack = await wsLogin(loginName.trim(), password);
    setLoading(false);
    if (ack.ok) {
      pushToast({ kind: "success", message: "Bem-vindo de volta!" });
      setPassword("");
      closeAuth();
    } else {
      setError(ack.message ?? "Não foi possível continuar.");
    }
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    if (tab === "login") void submitLogin();
    else next();
  };

  const switchTab = (t: "login" | "register") => {
    setTab(t);
    setStep(1);
    setError(null);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={closeAuth}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-sm animate-slideUp flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-ink-850 shadow-pop sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="relative flex shrink-0 flex-col items-center gap-1 border-b border-white/5 bg-gradient-to-b from-ink-800 to-ink-850 px-5 py-5">
          <BrandLogo size={32} />
          <p className="text-xs text-slate-400">
            {tab === "login" ? "Acesse sua conta" : "Abra sua conta — leva 2 minutos"}
          </p>
          <button
            onClick={closeAuth}
            className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-white"
            aria-label="Fechar"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Abas */}
        <div className="flex shrink-0 border-b border-white/5">
          {(["login", "register"] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={[
                "flex-1 py-3 text-sm font-bold transition",
                tab === t ? "bg-ink-700 text-white" : "text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              {t === "login" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>

        {/* Barra de progresso (só no cadastro) */}
        {tab === "register" && (
          <div className="shrink-0 px-5 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-white">{STEPS[step - 1].title}</span>
              <span className="text-[11px] font-medium text-slate-500">
                Etapa {step} de {TOTAL}
              </span>
            </div>
            <div className="flex gap-1.5">
              {STEPS.map((s) => (
                <div
                  key={s.n}
                  className={[
                    "h-1.5 flex-1 rounded-full transition-colors",
                    s.n <= step ? "bg-brand" : "bg-ink-700",
                  ].join(" ")}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">{STEPS[step - 1].subtitle}</p>
          </div>
        )}

        {/* Corpo */}
        <div className="space-y-3 overflow-y-auto p-5">
          {/* ---------- LOGIN ---------- */}
          {tab === "login" && (
            <>
              <Field label="Login" icon="user">
                <input
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  onKeyDown={onEnter}
                  placeholder="seu_usuario"
                  autoFocus
                  className="auth-input"
                />
              </Field>
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
            </>
          )}

          {/* ---------- CADASTRO · ETAPA 1: dados ---------- */}
          {tab === "register" && step === 1 && (
            <>
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
              <Field label="CPF" icon="shield">
                <input
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  onKeyDown={onEnter}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="auth-input"
                />
                <AvailabilityHint status={cpfStatus} takenMsg="Já existe conta com este CPF" />
              </Field>
              <Field label="Data de nascimento" icon="calendar">
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

          {/* ---------- CADASTRO · ETAPA 2: contato ---------- */}
          {tab === "register" && step === 2 && (
            <>
              <Field label="E-mail" icon="mail">
                <input
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={onEnter}
                  placeholder="voce@email.com"
                  autoFocus
                  className="auth-input"
                />
                <AvailabilityHint status={emailStatus} takenMsg="Já existe conta com este e-mail" />
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
            </>
          )}

          {/* ---------- CADASTRO · ETAPA 3: acesso ---------- */}
          {tab === "register" && step === 3 && (
            <>
              <Field label="Login" icon="user">
                <input
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  onKeyDown={onEnter}
                  placeholder="seu_usuario"
                  autoFocus
                  className="auth-input"
                />
                <AvailabilityHint status={loginStatus} takenMsg="Este login já está em uso" />
              </Field>
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
              {password.length > 0 && (
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
                  <span className="w-20 text-right text-[10px] text-slate-500">
                    Senha {STRENGTH[score].label}
                  </span>
                </div>
              )}
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
              <Field label="Código de indicação" icon="ticket" hint="opcional">
                <input
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value.toUpperCase())}
                  onKeyDown={onEnter}
                  placeholder="Ex.: ABC123"
                  maxLength={12}
                  className="auth-input uppercase"
                />
              </Field>
              <label className="flex cursor-pointer items-start gap-2 pt-1 text-[12px] leading-snug text-slate-400">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                />
                <span>
                  Declaro ter 18 anos ou mais e concordo com os Termos de Uso. Plataforma
                  demonstrativa, conforme a Lei nº 14.790/2023. Jogue com responsabilidade.
                </span>
              </label>
            </>
          )}

          {/* Erro */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-live/40 bg-live/10 px-3 py-2 text-sm text-live">
              <Icon name="info" size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Ações */}
          {tab === "login" ? (
            <button
              onClick={submitLogin}
              disabled={loading}
              className="mt-1 w-full rounded-xl bg-brand py-3 text-base font-bold text-ink-950 shadow-glow transition hover:bg-brand-dark disabled:opacity-60"
            >
              {loading ? "Aguarde…" : "Entrar"}
            </button>
          ) : (
            <div className="mt-1 flex gap-2">
              {step > 1 && (
                <button
                  onClick={back}
                  disabled={loading}
                  className="flex items-center justify-center gap-1 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-ink-700 disabled:opacity-60"
                >
                  <Icon name="chevronRight" size={16} className="rotate-180" />
                  Voltar
                </button>
              )}
              <button
                onClick={next}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3 text-base font-bold text-ink-950 shadow-glow transition hover:bg-brand-dark disabled:opacity-60"
              >
                {loading
                  ? "Aguarde…"
                  : step < TOTAL
                    ? "Continuar"
                    : "Criar conta e ganhar R$ 1.000"}
                {!loading && (
                  <Icon name={step < TOTAL ? "chevronRight" : "check"} size={16} />
                )}
              </button>
            </div>
          )}

          {/* Rodapé */}
          {tab === "login" && (
            <p className="text-center text-[11px] text-slate-500">
              Não tem conta?{" "}
              <button onClick={() => switchTab("register")} className="font-semibold text-brand-light">
                Cadastre-se grátis
              </button>
            </p>
          )}
          {tab === "register" && (
            <p className="text-center text-[11px] text-slate-500">
              Já tem conta?{" "}
              <button onClick={() => switchTab("login")} className="font-semibold text-brand-light">
                Entrar
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

/** Indicador de disponibilidade (verificando / disponível / em uso) sob o campo. */
function AvailabilityHint({ status, takenMsg }: { status: AvailStatus; takenMsg: string }) {
  if (status === "idle") return null;
  if (status === "checking")
    return <p className="mt-1 text-[11px] text-slate-500">Verificando disponibilidade…</p>;
  if (status === "available")
    return (
      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-brand-light">
        <Icon name="check" size={12} /> Disponível
      </p>
    );
  return (
    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-live">
      <Icon name="close" size={12} /> {takenMsg}
    </p>
  );
}

function Field({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon: IconName;
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
