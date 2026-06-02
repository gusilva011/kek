/**
 * Regenera o acervo de DEMONSTRAÇÃO do CRM (clientes + apostas sintéticos).
 *
 * Remove as contas/apostas demo antigas (marcadas `demo:true` / IDs `bd_`),
 * gera um acervo novo e grava — preservando as contas REAIS. Atualiza o marcador
 * para o gateway não re-semear por cima.
 *
 * Uso:   npm run demo:reseed         (160 clientes, padrão)
 *        npm run demo:reseed 300     (quantidade custom)
 *
 * ⚠️ Rode com o gateway PARADO (ou reinicie o `npm run dev` logo depois): se o
 * servidor estiver no ar, ele tem o estado antigo em memória e pode sobrescrever
 * os arquivos no próximo save.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { generateDemoDataset } from "./demoData";
import type { StoredBet, StoredUser } from "./store";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* ausente — ok */
}

const DATA = join(process.cwd(), "data");
const read = <T>(name: string, fallback: T): T => {
  try {
    const p = join(DATA, name);
    return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (name: string, data: unknown): void => {
  if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true });
  writeFileSync(join(DATA, name), JSON.stringify(data, null, 2), "utf8");
};

function main(): void {
  const count = Math.max(10, Math.min(1000, Number(process.argv[2]) || 160));

  const users = read<StoredUser[]>("users.json", []);
  const bets = read<StoredBet[]>("bets.json", []);

  const demoIds = new Set(users.filter((u) => u.demo).map((u) => u.id));
  const realUsers = users.filter((u) => !u.demo);
  const realBets = bets.filter((sb) => !demoIds.has(sb.ownerUserId) && !sb.bet.id.startsWith("bd_"));

  const removedUsers = users.length - realUsers.length;
  const removedBets = bets.length - realBets.length;

  const fresh = generateDemoDataset(count);

  write("users.json", [...realUsers, ...fresh.users]);
  write("bets.json", [...realBets, ...fresh.bets]);
  write("demo-seeded.json", { seeded: true, count: fresh.users.length, bets: fresh.bets.length, at: Date.now(), reseeded: true });

  console.log(`[reseed] removidos ${removedUsers} clientes e ${removedBets} apostas demo antigos.`);
  console.log(`[reseed] gerados ${fresh.users.length} clientes e ${fresh.bets.length} apostas; ${realUsers.length} contas reais preservadas.`);
  console.log(`[reseed] ✅ pronto. Reinicie o gateway (Ctrl-C + npm run dev) para carregar o novo acervo.`);
}

main();
