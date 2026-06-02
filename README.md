# BrasilBet — Plataforma de Apostas Esportivas (sportsbook)

Plataforma **multi-tenant (white-label)** de apostas esportivas: board **multi-esporte
em tempo real** (com ao vivo), **bilhete** (simples + múltiplas), **carteira**, **cashout**,
**login/cadastro**, **detalhe do jogo com todos os mercados**, **banners/promoções**
configuráveis e **backoffice completo** (BI + CRM + afiliados). Pensada para ser vendida
como software a operadores (B2B) — cada cliente com sua própria marca.

> ⚠️ **Estágio: DEMO.** Dinheiro **fictício**; depósito/saque **simulados**. Os JOGOS e as
> ODDS são **reais** (colhidos de APIs de odds). Operar com dinheiro real no Brasil exige
> licença da **SPA/Ministério da Fazenda** (Lei 14.790/2023). Jogo responsável. +18.

---

## 🟢 Estado atual (jun/2026) — leia antes de continuar

Front praticamente completo e **todo em PT-BR**: board multi-esporte real + ao vivo, bilhete,
carteira, detalhe com todos os mercados, backoffice BI/CRM/afiliados. **~444 jogos · 13
esportes** no acervo (`data/demo-matches.json`).

**A parede recorrente é a COTA da API-Football grátis (100 req/dia).** As chaves de teste do
`.env.local` foram **SUSPENSAS** pelo provedor (repo público → varredura automática). Por isso
o projeto está rodando em **`ODDS_PROVIDER=demo`** — reanima os jogos REAIS com "ao vivo"
simulado, board sempre cheio, **sem gastar cota**. Para ao vivo REAL (`live`): gere uma chave
nova em [dashboard.api-football.com](https://dashboard.api-football.com), cole em
`APIFOOTBALL_KEY` no `.env.local` e troque para `ODDS_PROVIDER=live`.

**Logos/escudos:** o board carrega o símbolo de cada time/atleta **assado no acervo**
(`npm run feed:logos`, via TheSportsDB) — escudo de clube, foto de lutador/tenista ou bandeira
de seleção. Quando não há imagem em nenhuma fonte, mostra um monograma escuro discreto
(padronizado, nunca um "quadrado branco" ou bola colorida).

**Próximos passos naturais:**
1. Trocar a persistência JSON por **Postgres** (`src/server/persist.ts` — a API do `store.ts` não muda).
2. **Gateway de pagamento real** (Pix/KYC: Mercado Pago/Asaas/Efí) no lugar do depósito/saque simulado (isolado no `store.ts`).
3. **Plano pago da API-Football** → live contínuo + odds ao vivo reais + todos os mercados sem esgotar cota.

---

## Como rodar

```bash
npm install
npm run dev      # sobe web (:3000) + gateway WebSocket (:4000) juntos via concurrently
```

- App: **http://localhost:3000**
- Gateway/health: **http://localhost:4000/health**
- Antes de concluir mudanças: `npm run typecheck`.

> O repo de handoff já vem com `.env.local` (chaves de teste) e `data/` (acervo de jogos reais +
> contas demo) **versionados** — é só clonar, `npm install` e `npm run dev`. Não precisa configurar nada.

### Logins
- **Backoffice** (`/admin`): `admin` · senha `admin123`
- **Contas demo do CRM**: qualquer login demo · senha `demo1234`
- Ou **cadastre-se** na home (ganha R$ 1.000 fictícios).

### Scripts de dados (precisam de chave válida / internet)
- `npm run feed:harvest` — colhe **odds reais** (futebol da API-Football + multi-esporte da The Odds API) → `data/demo-matches.json`. Passe um número (`feed:harvest 500`) para sintetizar odds e encher mais o board. **Gasta cota.** Reinicie o gateway depois.
- `npm run feed:logos` — resolve escudo/foto de **todos** os competidores (TheSportsDB) e grava no acervo. Cache idempotente/retomável (`data/logo-cache.json`); se parar por rate-limit (429), rode de novo que continua. Rode **depois** de cada `feed:harvest`. Reinicie o gateway no fim.
- `npm run demo:reseed [qtd]` — regenera o acervo demo do CRM (rode com o gateway PARADO).

---

## Fonte de dados (`.env.local` → `ODDS_PROVIDER`)

| Modo | O que faz | Cota |
|---|---|---|
| **demo** *(ativo)* | Jogos REAIS do acervo + "ao vivo" SIMULADO por cima (board sempre cheio) | **Não gasta** |
| **live** | Acervo (pré-jogo) + jogos REALMENTE ao vivo agora (`/fixtures?live=all`, placar/minuto reais) | ~1 req/min |
| **apifootball** | Feed pré-jogo (1.200+ ligas + logos) | Gasta |
| **theoddsapi** | Cobertura menor (ligas grandes), mercados estendidos sob demanda | Gasta (500/mês) |
| **simulation** | Jogos fictícios COM ao vivo (evite em demos — times fakes) | Não gasta |

O motor é escolhido em `src/server/index.ts` (`makeEngine()`); todos implementam a interface
`OddsSource` e emitem os mesmos eventos, então o cliente não muda entre modos.

---

## Arquitetura

```
   Browser (Next.js)            Gateway WebSocket :4000
 ┌───────────────────┐        ┌─────────────────────────┐
 │  React + Zustand  │◄─ ws ─►│  Motor de odds (engine) │  ← jogos/odds, gols,
 │  board / bilhete  │        │  store (carteira/aposta)│    suspensão, liquidação,
 │  carteira / admin │        │  auth + backoffice      │    contas e apostas
 └───────────────────┘        └─────────────────────────┘
```

- **Tempo real:** um único canal WebSocket entrega snapshot, odds/placar ao vivo, apostas, cashout e ações de admin. O gateway agrupa updates num `matches_batch`/seg (board fluido com centenas de jogos).
- **Persistência:** arquivos JSON em `data/` via `src/server/persist.ts` (trocar por Postgres em produção; a API do `store.ts` não muda).

### Estrutura de pastas
```
src/
  shared/       Tipos + IDs compartilhados (o "contrato" servidor↔cliente)
  server/       Motor de odds, ledger e gateway WebSocket (rodado via tsx)
    index.ts        Gateway WS (escolhe o motor: live/demo/apifootball/…)
    liveEngine.ts   Ao vivo REAL (polling /fixtures?live=all)
    demoEngine.ts   Jogos reais + ao vivo simulado (vitrine, sem cota)
    store.ts        Contas, carteira, apostas, afiliados, backoffice (JSON)
    auth.ts         Hash de senha (scrypt), sessões, rate-limit
    providers/      apiFootball, theOddsApi, harvest, logoBackfill, synthOdds
  lib/          Cliente WebSocket, i18n (PT-BR), logos, formatação
  store/        Estado global do cliente (Zustand)
  components/   UI (board, bilhete, detalhe, carteira, admin/backoffice…)
  app/          Next.js App Router (home, /perfil, /afiliados, /admin)
```

---

## O que já está pronto

- ✅ **Board multi-esporte real** (futebol, basquete, tênis, MMA/UFC, boxe, beisebol, fut. americano, hóquei, rugby, críquete, AFL…) com **ao vivo**, organização por importância e filtro por esporte/mercado
- ✅ **Detalhe do jogo** com **todos os mercados** (até ~59 no futebol), traduzidos para PT-BR
- ✅ **Bilhete** com **apostas múltiplas** (auto-switch), proteção contra mudança de odd e validação anti-fraude ao vivo no servidor
- ✅ **Login/cadastro** completo (CPF validado, +18, senha scrypt), **carteira** (depósito + saque Pix simulado + extrato), **perfil**
- ✅ **Cashout** ao vivo + **liquidação automática** no fim do jogo
- ✅ **Crests padronizados**: escudo de clube / foto de atleta / bandeira de seleção — assados no acervo (CDN), com monograma escuro discreto onde não há imagem
- ✅ **Backoffice** (`/admin`): Dashboard BI (KPIs, gráficos SVG, funil, ranking), **CRM** (lista/detalhe/ajuste/bloqueio/export CSV), **Afiliados** (rev-share, GGR, comissão), Marca/Banners/Promoções (CRUD + upload)
- ✅ **Programa de afiliados** (código + link `?ref=`, comissão = % do GGR dos indicados)
- ✅ **Acervo demo do CRM** (~160 clientes BR sintéticos com histórico realista) auto-semeado no modo `demo`
- ✅ **Mobile responsivo**, design premium (ícones SVG, bandeiras flagcdn), **multi-tenant** (white-label)
- ✅ Segurança: rate-limit anti-brute-force + sessões persistidas que sobrevivem ao restart

---

## Roadmap até produção

A arquitetura evolui **sem reescrita** — trocam-se peças nas bordas:

| # | Etapa | O que muda |
|---|---|---|
| 1 | **Persistência** | JSON → **Postgres** (mesma API de `store.ts`/`persist.ts`) |
| 2 | **Pagamentos + KYC** | Pix entrada/saque real (Mercado Pago/Asaas/Efí), antifraude (isolado em `store.ts`) |
| 3 | **Feed pago de odds** | Plano pago da API-Football (ou Sportradar/Genius) → live contínuo + odds ao vivo reais |
| 4 | **Escala em tempo real** | EventEmitter → Redis pub/sub para múltiplas instâncias do gateway |
| 5 | **White-label completo** | Temas/domínios por tenant, mais módulos de backoffice (risco, relatórios) |
| 6 | **Conformidade** | Jogo responsável (limites/autoexclusão), auditoria, licença SPA/MF (do operador cliente) |

### Notas técnicas (estágio demo)
- **Saque/depósito são simulados** — dinheiro real exige gateway de pagamento + KYC.
- O **ao vivo do modo `demo`** é simulado por cima de jogos reais; o placar/minuto reais exigem `live` (com chave válida) ou plano pago.
- Cota da API-Football grátis = 100 req/dia (a parede recorrente). Plano pago libera todos os jogos/mercados + live contínuo.

---

Configuração de portas/URL: `.env.local` define `NEXT_PUBLIC_WS_URL` (browser) e `WS_PORT` (gateway).
Contexto completo do projeto (decisões, fonte de dados, limitações): ver **`CLAUDE.md`** na raiz.
