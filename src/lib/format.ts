/** Formatação de moeda e odds (pt-BR). */

export function formatMoney(value: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(value);
}

export function formatOdds(odds: number): string {
  return odds.toFixed(2);
}

/** Valor monetário compacto para eixos/KPIs: R$ 1,2 mil · R$ 3,4 mi. */
export function formatMoneyCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(".", ",")} mi`;
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1).replace(".", ",")} mil`;
  return `${sign}R$ ${abs.toFixed(0)}`;
}

/** Número inteiro com separador de milhar pt-BR. */
export function formatInt(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

/** Tempo relativo curto (pt-BR): "agora", "5 min", "3 h", "2 d". */
export function formatAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} d`;
  const mo = Math.floor(d / 30);
  return `${mo} mês${mo > 1 ? "es" : ""}`;
}

/** Horário do jogo: "HH:MM" se hoje, senão "DD/MM". */
export function formatKickoff(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Segundos → "m:ss" (para contagem regressiva). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Formata CPF (só dígitos) como 000.000.000-00, parcial conforme digita. */
export function formatCpf(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

/** Mascara o CPF para exibição (mantém início e fim). */
export function maskCpf(digits: string): string {
  const d = (digits ?? "").replace(/\D/g, "");
  if (d.length !== 11) return d || "—";
  return `${d.slice(0, 3)}.***.***-${d.slice(9, 11)}`;
}

/** Formata telefone (só dígitos) como (00) 00000-0000. */
export function formatPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}
