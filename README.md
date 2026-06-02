# BrasilBet — Plataforma de Apostas Esportivas (sportsbook)

Plataforma **multi-tenant (white-label)** de apostas esportivas com **odds ao vivo
em tempo real**, **bet slip**, **carteira**, **cashout**, **login/cadastro**,
**banners e promoções configuráveis** e **backoffice**. Pensada para ser vendida
como software para operadores (B2B) — cada cliente com sua marca.

> ⚠️ **Estágio atual: DEMO.** Dinheiro **fictício**, odds **simuladas** por um motor
> próprio (não há feed real nem dinheiro real). Serve para desenvolver, demonstrar e
> validar o produto. Operar apostas com dinheiro real no Brasil exige licença da
> **SPA/Ministério da Fazenda** (Lei 14.790/2023). Jogo responsável. +18.

---

## Como rodar

```bash
npm install
npm run dev
```

- App: **http://localhost:3000**
- Gateway de odds (WebSocket + health): **http://localhost:4000/health**

`npm run dev` sobe os dois processos juntos (Next.js + gateway WebSocket) via
`concurrently`. Para rodar separados: `npm run dev:web` e `npm run dev:ws`.

---

## Acesso (demo)

- **Cliente:** clique em **Cadastrar** (login + senha + telefone) e ganhe R$ 1.000
  de saldo fictício. Depois é só **Entrar**.
- **Backoffice:** acesse **/admin** logado como administrador.
  Conta admin padrão — login: `admin` · senha: `admin123`.

> As contas e configurações ficam em `data/*.json` (criados na 1ª execução).
> Os tokens de sessão são em memória, então após reiniciar o servidor é preciso
> entrar de novo (a conta continua salva).

---

## Arquitetura

```
                          ┌───────────────────────────┐
   Browser (Next.js)      │   Gateway WebSocket :4000  │
 ┌───────────────────┐    │  ┌─────────────────────┐  │
 │  React + Zustand  │◄──►│  │  Motor de simulação │  │  ← gera jogos/odds,
 │  bet slip /       │ ws │  │  (engine.ts + odds) │  │    gols, suspensões
 │  cashout / saldo  │    │  └─────────┬───────────┘  │
 └───────────────────┘    │  ┌─────────▼───────────┐  │
                          │  │  Ledger (store.ts)  │  │  ← carteira, apostas,
                          │  │  carteira + apostas │  │    liquidação, auditoria
                          │  └─────────────────────┘  │
                          └───────────────────────────┘
```

- **Tempo real:** um único canal WebSocket entrega snapshot inicial, atualizações
  de odds/placar ao vivo, e o request/response de apostar e fazer cashout.
- **Odds:** modelo de Poisson de gols restantes (placar + tempo + força dos times)
  com margem da casa (overround ~7%). Reagem de forma crível a gols e ao relógio.
- **Dinheiro:** carteira em ledger com trilha de auditoria de cada movimento.

### Estrutura de pastas

```
src/
  shared/        Tipos + IDs compartilhados entre servidor e cliente (o "contrato")
  server/        Motor de simulação, ledger e gateway WebSocket (rodado via tsx)
    odds.ts        Modelo probabilístico → odds (com margem)
    engine.ts      Geração de jogos, ticks, gols, suspensão, liquidação
    store.ts       Contas, carteira, apostas, banners e promoções (persistido em JSON)
    auth.ts        Hash de senha (scrypt), tokens e validação
    persist.ts     Carga/gravação dos arquivos data/*.json
    index.ts       Gateway WebSocket (orquestra engine + store + auth)
  lib/           Cliente WebSocket, formatação, hooks
  store/         Estado global do cliente (Zustand)
  components/    UI (board, odd, bet slip, banners, auth, admin/backoffice…)
  app/           Next.js App Router (home, /promocoes, /admin)
```

---

## O que já está pronto

- ✅ **Layout profissional de 3 colunas** (navegação de esportes/ligas · eventos ·
  boletim), no padrão das grandes casas
- ✅ **Design system premium**: ícones SVG próprios, escudos dos times, fonte Inter,
  ribbon de esportes, sombras/profundidade, rodapé completo e micro-interações
- ✅ Faixa de **destaques**, **busca** por time, filtros (Ao Vivo/Próximas) e
  **seletor de mercado** (colunas de odds)
- ✅ Board de futebol com partidas **ao vivo** e **pré-jogo** (4 ligas)
- ✅ **Odds em tempo real** que sobem/descem com indicador visual (▲▼)
- ✅ Relógio do jogo, placar ao vivo e **suspensão de mercado no gol** (🔒)
- ✅ **Bet slip** com retorno potencial e **proteção contra mudança de odd**
- ✅ **Apostas múltiplas (acumuladas)**: várias seleções, odds multiplicadas, ganha se todas baterem
- ✅ **Detalhe do jogo** (clicar na partida) com **todos os mercados** da API (resultado,
  total, ambos marcam, dupla chance, empate anula…) — carregados sob demanda
- ✅ **Multi-esporte**: futebol, basquete, tênis, MMA, boxe, beisebol, fut. americano,
  críquete, hóquei, rugby… (todos os esportes ativos da API) com filtro por esporte
  e mercado de 2 vias ("Vencedor") onde não há empate
- ✅ **Logos reais dos clubes** (TheSportsDB, cache no navegador) + **bandeiras** das seleções;
  monograma sempre por baixo (nunca fica em branco)
- ✅ Múltipla **automática** ao adicionar 2+ seleções
- ✅ Rodapé com **Pix** + bloco de licença/responsabilidade (SPA/Lei 14.790, 18+)
- ✅ Carteira (saldo fictício) com débito/crédito atômico
- ✅ **Cashout** ao vivo (valor indicativo recalculado a cada odd) + execução
- ✅ **Liquidação automática** quando a partida termina (ganhou/perdeu)
- ✅ **Login / cadastro** (login, senha, telefone) com senha em **hash (scrypt)**
- ✅ **Banners** rotativos na home, configuráveis no backoffice (com **upload de
  imagem do computador** — comprimida no navegador)
- ✅ Página de **Promoções** configurável
- ✅ **Logo da marca** (SVG padrão) + **upload de logo** e nome no backoffice (white-label)
- ✅ Diferenciação visual **pré-jogo × ao vivo** (cards de destaque + barra de progresso do jogo)
- ✅ **CPF obrigatório** no cadastro (validado) — base para saque somente ao titular
- ✅ **Carteira**: depósito e **saque via Pix** (simulado), com **extrato** de transações
- ✅ **Página de perfil** (`/perfil`): dados, saldo, depósito/saque e histórico
- ✅ **Mobile responsivo**: navegação inferior + boletim em gaveta (bottom sheet)
- ✅ Bandeiras em **SVG** e **escudos com a cor real** de cada time
- ✅ **Backoffice** (`/admin`) protegido por papel: dashboard + CRUD de marca, banners e promoções
- ✅ **Persistência** em arquivos JSON (contas, apostas, banners, promoções)
- ✅ Reconexão automática do WebSocket + heartbeat
- ✅ Estrutura **multi-tenant** (campo `tenantId`) pronta para white-label

---

## Fornecedor de odds real — **API-Football ligado**

A fonte de dados é escolhida em `.env.local`:

```ini
ODDS_PROVIDER=apifootball   # "simulation" | "theoddsapi" | "apifootball"
APIFOOTBALL_KEY=suachave    # grátis em dashboard.api-football.com (100 req/dia)
ODDS_API_KEY=suachave       # alternativa: the-odds-api.com (cobertura menor)
ODDS_REFRESH_MS=10800000    # intervalo de atualização (padrão 3h)
```

**API-Football** (`server/providers/apiFootball.ts`) é o provedor recomendado:
cobertura **ampla** (1.200+ ligas — amistosos, copas regionais, divisões inferiores)
+ **logos reais** de times e ligas. Modelo: `/fixtures?date=` (jogos do dia) +
`/odds?date=` (paginado), juntados por fixture id; vários mercados por jogo.
Plano grátis = 100 req/dia, por isso o refresh é longo e há cache em disco.

- **`theoddsapi`** → odds **reais** via [The Odds API](https://the-odds-api.com)
  (`server/realFeed.ts` + `server/providers/theOddsApi.ts`). Competições ativas são
  configuradas em `SPORT_KEYS` (hoje: Copa do Mundo, Libertadores, Sul-Americana,
  Série B, J-League, Allsvenskan — ligas europeias estão fora de temporada).
- **`simulation`** → motor próprio com **partidas ao vivo** (placar, minuto,
  cashout, liquidação automática).
- **Economia de cota:** cache em `data/odds-cache.json` (restarts reusam) +
  refresh lento. `npm run feed:test` valida a chave imprimindo jogos reais.

> ⚠️ **Limitação desta etapa:** o endpoint de odds traz **pré-jogo**. "Ao vivo"
> (placar/minuto) e a **liquidação automática** de jogos reais exigem o endpoint
> de *scores* — próximo passo. Por isso, para a demo "ao vivo" completa, use
> `ODDS_PROVIDER=simulation`.

> ⚠️ Depósitos e saques são **simulados** (demo). O movimento real de dinheiro
> exige um **gateway de pagamento** (Mercado Pago, Asaas, Efí/Pagar.me) + KYC.
> O ponto de integração já está isolado em `store.ts` (`deposit`/`withdraw`).

## Roadmap até produção

A arquitetura foi feita para evoluir **sem reescrita** — trocamos peças nas bordas:

| # | Etapa | O que muda |
|---|---|---|
| 1 | **Persistência** | Ledger em memória → **Prisma + Postgres** (mesma API de `store.ts`) |
| 2 | **Autenticação real** | Login/cadastro, sessões, papéis (apostador / admin / trader) |
| 3 | **Painel admin/trader** | Gestão de mercados, limites de risco, relatórios, contas |
| 4 | **Feed real de odds** | Motor de simulação → adaptador de **Sportradar / Genius / OddsMatrix** (mesmos eventos `match_update` / `match_finished`) |
| 5 | **Escala em tempo real** | EventEmitter → **Redis pub/sub** para múltiplas instâncias do gateway |
| 6 | **Pagamentos + KYC** | Pix (entrada/saque), verificação de identidade, antifraude, AML |
| 7 | **White-label completo** | Temas/marcas por tenant, domínios, configurações por operador |
| 8 | **Conformidade** | Jogo responsável (limites, autoexclusão), trilhas de auditoria, licença SPA/MF |

### Notas técnicas (estágio demo)

- O **estado é em memória**: reiniciar o gateway zera carteiras e apostas. A
  persistência (etapa 1) resolve isso.
- As **odds são simuladas** para desenvolvimento — não refletem partidas reais.
- O tempo é **acelerado** (uma partida dura ~2 min) para facilitar a demonstração.
```

Configuração: `.env.local` define `NEXT_PUBLIC_WS_URL` (browser) e `WS_PORT` (gateway).
```
