/**
 * Persistência simples em arquivos JSON (estágio demo).
 *
 * Carrega na inicialização e salva com debounce a cada mudança. Sem
 * dependências nativas — robusto no Windows. Em produção, troca-se por
 * Postgres sem alterar a lógica de negócio do `Store`.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");

export function loadJson<T>(name: string, fallback: T): T {
  try {
    const p = join(DATA_DIR, name);
    if (!existsSync(p)) return fallback;
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return fallback;
  }
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function saveJson(name: string, data: unknown): void {
  const existing = timers.get(name);
  if (existing) clearTimeout(existing);
  timers.set(
    name,
    setTimeout(() => {
      try {
        if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
        writeFileSync(join(DATA_DIR, name), JSON.stringify(data, null, 2), "utf8");
      } catch {
        /* ignore — demo */
      }
      timers.delete(name);
    }, 250),
  );
}
