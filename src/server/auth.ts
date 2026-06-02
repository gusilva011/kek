/**
 * Helpers de autenticação. Senhas são sempre armazenadas com hash (scrypt do
 * Node, sem dependências externas) + salt por usuário. Tokens de sessão são
 * aleatórios. Validação simples de cadastro (login, senha, telefone).
 */

import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const h = scryptSync(password, salt, 64);
  const known = Buffer.from(hash, "hex");
  return h.length === known.length && timingSafeEqual(h, known);
}

export function newToken(): string {
  return randomBytes(24).toString("hex");
}

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

/** Código de afiliado: 6 caracteres legíveis (sem 0/O/1/I para evitar confusão). */
export function newAffiliateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[bytes[i] % alphabet.length];
  return code;
}

/** Normaliza para só dígitos. */
export function normalizePhone(phone: string): string {
  return (phone ?? "").replace(/\D/g, "");
}
export function normalizeCpf(cpf: string): string {
  return (cpf ?? "").replace(/\D/g, "");
}

/** Valida CPF (11 dígitos + dígitos verificadores). */
export function isValidCpf(cpf: string): boolean {
  const c = normalizeCpf(cpf);
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false; // todos iguais
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

/**
 * Limitador de taxa por chave (janela deslizante, em memória). Usado contra
 * brute-force de login e flood de cadastro.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number) {}

  /** Registra uma tentativa e retorna true se ainda dentro do limite. */
  check(key: string): boolean {
    const now = Date.now();
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    arr.push(now);
    this.hits.set(key, arr);
    return arr.length <= this.max;
  }

  /** Quantos ms faltam até liberar (0 se já liberado). */
  retryAfterMs(key: string): number {
    const now = Date.now();
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (arr.length <= this.max) return 0;
    return Math.max(0, this.windowMs - (now - arr[0]));
  }

  /** Zera o contador (ex.: após login bem-sucedido). */
  reset(key: string): void {
    this.hits.delete(key);
  }
}

/** Valida o formato de um e-mail (checagem prática, não RFC completa). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email ?? "").trim());
}

/** Idade em anos a partir de uma data ISO (YYYY-MM-DD); NaN se inválida. */
export function ageFromBirthDate(birthDate: string): number {
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return NaN;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export interface RegistrationInput {
  login: string;
  password: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string;
  /** Código de indicação (afiliado), se o cadastro veio por link ?ref=. */
  ref?: string;
}

/** Retorna mensagem de erro, ou null se válido. */
export function validateRegistration(i: RegistrationInput): string | null {
  if (!i.login || i.login.trim().length < 3) return "O login deve ter ao menos 3 caracteres.";
  if (!/^[a-zA-Z0-9_.]+$/.test(i.login)) return "Login: use apenas letras, números, ponto ou _.";
  if (!i.name || i.name.trim().length < 3 || !i.name.trim().includes(" "))
    return "Informe seu nome completo (nome e sobrenome).";
  if (!isValidEmail(i.email)) return "E-mail inválido.";
  if (!i.password || i.password.length < 6) return "A senha deve ter ao menos 6 caracteres.";
  const digits = normalizePhone(i.phone);
  if (digits.length < 10 || digits.length > 11) return "Telefone inválido (informe DDD + número).";
  if (!isValidCpf(i.cpf)) return "CPF inválido. Confira os números.";
  const age = ageFromBirthDate(i.birthDate);
  if (Number.isNaN(age)) return "Informe sua data de nascimento.";
  if (age < 18) return "É necessário ter 18 anos ou mais para se cadastrar.";
  if (age > 120) return "Data de nascimento inválida.";
  return null;
}
