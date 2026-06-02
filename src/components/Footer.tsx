"use client";

import Link from "next/link";
import { BrandLogo } from "./BrandLogo";
import { Icon } from "./ui/Icon";
import { PixLogo } from "./ui/PixLogo";

const COLUMNS: { title: string; links: string[] }[] = [
  { title: "Apostas", links: ["Futebol", "Ao Vivo", "Destaques", "Promoções"] },
  { title: "Ajuda", links: ["Central de ajuda", "Como apostar", "Cashout", "Contato"] },
  { title: "Sobre", links: ["Sobre a BrasilBet", "Termos de uso", "Privacidade", "Trabalhe conosco"] },
];

export function Footer() {
  return (
    <footer className="mt-8 border-t border-white/5 bg-ink-950/60">
      <div className="mx-auto max-w-[1400px] px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <BrandLogo size={30} />
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-slate-500">
              Plataforma demonstrativa de apostas esportivas. Odds simuladas e dinheiro fictício —
              feita para demonstração e desenvolvimento.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-600">Pagamentos</span>
              <span className="flex h-7 items-center rounded-md bg-ink-700 px-2">
                <PixLogo size={14} />
              </span>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{col.title}</div>
              <ul className="space-y-2 text-sm text-slate-500">
                {col.links.map((l) => (
                  <li key={l}>
                    <Link href={l === "Promoções" ? "/promocoes" : "/"} className="transition hover:text-slate-300">
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-white/5 pt-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-slate-500 font-black text-slate-300">
              18
            </span>
            <span className="max-w-md leading-relaxed">
              Proibido para menores de 18 anos. Aposte com responsabilidade — jogo pode causar
              dependência. Em caso de necessidade, procure ajuda.
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Icon name="shield" size={14} className="text-brand-light" />
            © 2026 BrasilBet · Demonstração
          </div>
        </div>
      </div>

      {/* Faixa de licença / responsabilidade (estilo casas reais) */}
      <div className="border-t border-white/5 bg-black/40">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-4 px-4 py-7 text-center">
          <div className="flex items-center justify-center gap-4">
            <p className="max-w-3xl text-[11px] leading-relaxed text-slate-500">
              <b className="text-slate-400">BrasilBet</b> é um site de entretenimento online que
              oferece uma experiência de apostas esportivas. Esta é uma <b>plataforma demonstrativa</b>,
              operada para fins de avaliação e desenvolvimento, sem movimentação real de dinheiro. Em
              produção, a operação de apostas de quota fixa no Brasil é autorizada pela Secretaria de
              Prêmios e Apostas (SPA) do Ministério da Fazenda, nos termos da Lei nº 14.790/2023.
            </p>
            <PixLogo size={26} showText={false} />
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-500 text-[10px] font-black text-slate-300">
              18+
            </span>
            <span className="text-sm font-semibold tracking-tight text-slate-400">
              Be<span className="text-slate-300">Gamble</span>Aware<span className="align-super text-[8px]">®</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
