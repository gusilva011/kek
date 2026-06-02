# CLAUDE.md — Contexto do projeto (BrasilBet)

Plataforma de **apostas esportivas** (sportsbook) multi-tenant, white-label, estágio
**demo** (dinheiro fictício). Objetivo do dono (Gustavo): vender o software a
operadores. **Não fazer cassino** (decisão de valores do cliente — só esportivas).

> **Estado atual (jun/2026):** front quase completo (board multi-esporte real + ao vivo, bilhete, carteira,
> detalhe com todos os mercados, backoffice BI/CRM/afiliados, tudo em PT-BR). **A parede recorrente é a COTA
> da API-Football grátis (100 req/dia)** — o ao vivo real (`ODDS_PROVIDER=live`) a esgota em ~2-3h; aí use
> `demo` (sem cota) ou espere o reset (~meia-noite UTC). "Todos os jogos + todos os mercados + live contínuo"
> de verdade = **plano pago**. **Próximos passos naturais:** Postgres (trocar `persist.ts`), gateway de
> pagamento real (Pix/KYC), live odds reais (plano pago). Detalhes em "Limitações / pendências" abaixo.

## Como rodar
```bash
npm install
cp .env.example .env.local   # depois preencha as chaves (APIFOOTBALL_KEY, ODDS_API_KEY)
npm run feed:harvest 0       # (opcional, precisa de chave) colhe os jogos reais → data/demo-matches.json
npm run dev                  # sobe Next.js (web :3000) + gateway WebSocket (:4000) via concurrently
```
- App: http://localhost:3000 · Gateway/health: http://localhost:4000/health
- Verificar no navegador: preview via `.claude/launch.json` (nome "bet") ou abrir :3000.
- `npm run typecheck` antes de concluir mudanças.
- ⚠️ **Repo não inclui `.env.local` (chaves) nem `data/` (gitignored).** Num clone novo: crie o `.env.local`
  (a partir do `.env.example`), ponha as chaves, e rode `feed:harvest`. Sem acervo (`data/demo-matches.json`)
  o board fica vazio — use `ODDS_PROVIDER=demo` após colher, ou `live` com a chave da API-Football válida.
  Contas/CRM de demonstração são auto-semeadas em modo demo (idempotente).

## Stack
- **Next.js 14 (App Router, TS, Tailwind)** no front + **gateway WebSocket** (`ws`, rodado por `tsx`) no back.
- Estado do cliente: **Zustand** (`src/store/useStore.ts`). Tudo (snapshot, odds, apostas, auth, banners, promoções, carteira) passa por 1 canal WebSocket (`src/lib/ws.ts`).
- Persistência: **arquivos JSON** em `data/` (users, bets, banners, promotions, branding) via `src/server/persist.ts`. (Trocar por Postgres em produção — API do `store.ts` não muda.)

## Fonte de dados (IMPORTANTE)
`.env.local` → `ODDS_PROVIDER`: `live` | `demo` (ATIVO agora) | `apifootball` | `theoddsapi` | `simulation`.
> ⚠️ **Cota grátis da API-Football (100/dia) é a parede recorrente.** O modo `live` (polling) a esgota em ~2-3h; aí o live congela e não dá para re-colher. "Todos os jogos + todos os mercados + live contínuo" = **plano pago**. Sem cota, use `demo` (vivo, sem gastar). Reseta ~meia-noite UTC.
- **live** (ao vivo REAL): `src/server/liveEngine.ts`. Carrega o acervo (`data/demo-matches.json`) como PRÉ-JOGO e faz polling de `/fixtures?live=all` (API-Football) — placar/minuto/status REAIS dos jogos acontecendo AGORA. Odds ao vivo precificadas pelo placar/minuto real (`providers/synthOdds.liveMarkets`, modelo Poisson — o free não traz odds ao vivo; troque por reais no plano pago). Liquida quando o jogo encerra (FT). **GASTA COTA**: ~1 req/min (`LIVE_POLL_MS`, default 60s) → a chave grátis (100/dia) dura ~100 min/dia; cota esgotada congela o último estado (degradação suave). Para sempre-ligado, use o plano pago.
- **demo** (vitrine sem cota): `src/server/demoEngine.ts`. Carrega os jogos REAIS do cache e faz "rolar ao vivo" SIMULADO por cima (placar/odds reagindo) — **sem gastar cota**, board sempre cheio. Melhor para demos longas/fora de horário nobre (mostra Copa do Mundo "ao vivo" a qualquer hora). Troque para cá quando quiser economizar cota.
- **apifootball**: `src/server/providers/apiFootball.ts`. Cobertura ampla (1.200+ ligas) + **logos reais**. Chave `APIFOOTBALL_KEY` (grátis 100 req/dia — gerenciar cota!). Mercados já vêm no fetch. Traz só pré-jogo (sem live real).
- **theoddsapi**: `src/server/providers/theOddsApi.ts`. Cobertura menor (ligas grandes). Mercados estendidos via endpoint de evento (lazy, `load_markets`).
- **simulation**: `src/server/engine.ts`. Jogos fictícios COM live. (Evite em demos — tem times fictícios; o `demo` é melhor.)
- Motor real: `src/server/realFeed.ts` — `RealFeedEngine(fetchMatches, loadEventMarkets?)`, genérico; `index.ts` (`makeEngine()`) escolhe o provedor. Cache em `data/odds-cache.json` (refresh 3h).
- **Colhedor MULTI-ESPORTE**: `npm run feed:harvest` (`src/server/providers/harvest.ts`) colhe **odds REAIS** de DUAS fontes e grava em `data/demo-matches.json`: (1) **futebol** da API-Football (~60 jogos com odds reais) + (2) **multi-esporte** da The Odds API (NBA, MLB/KBO/NPB, NFL/NCAAF/CFL, MMA, boxe, tênis, NHL, rugby, críquete, AFL, handebol, lacrosse…). Rende **~428 jogos · 13 esportes** sem síntese. Passe um número como arg (`npm run feed:harvest 500`) para LIGAR a síntese de odds no futebol (`synthOdds.ts`, vitrine maior com odds geradas). Reinicie o gateway depois. Cota: ~11 req API-Football + ~36 The Odds API (500/mês).
- ⚠️ **Ao mudar o normalize de um provedor, apague `data/odds-cache.json`** (o cache pode estar sem campos novos).
- ⚠️ O servidor `tsx` lê o `.env.local` via `process.loadEnvFile` no topo do `index.ts` (Next lê sozinho; o ws não).

## Já implementado
Login/cadastro completo (login+senha+confirmação+medidor de força+nome+e-mail+telefone+**CPF** validado+nascimento **+18**, senha hash scrypt; apostar exige login) · **segurança**: rate-limit anti-brute-force (login/cadastro) + sessões persistidas que sobrevivem ao restart (`src/server/auth.ts`, `RateLimiter`) · **carteira** com depósito + **saque Pix SIMULADO** (só titular/CPF) + extrato · **perfil** `/perfil` · **boletim** com **apostas múltiplas** (auto-switch ao ter 2+) · **detalhe do jogo** (clicar) com todos os mercados · **multi-esporte** + **organização por importância** (`leaguePriority`/`sportPriority`) · **mobile responsivo** · design premium (ícones SVG `ui/Icon`, bandeiras flagcdn `ui/Flag`, escudos `ui/TeamCrest`).
- **Backoffice `/admin`** (`src/components/admin/`): **Dashboard BI** (`Dashboard.tsx` + gráficos SVG sem deps em `charts.tsx`: KPIs com tendência vs período anterior + sparklines, gráfico de movimentação barras+linha, **funil de aquisição por coorte do período**, donut de status, **ranking de clientes por volume apostado no período**, feed de atividade, filtro por dia/mês/ano — o período afeta funil e ranking) · **CRM** `ClientsManager` (lista/busca/detalhe, ajustar saldo, bloquear, **exportar CSV** dos filtrados) · **Afiliados** `AffiliatesManager` (taxa rev-share editável, indicados, GGR, comissão) · **Marca/Banners/Promoções** (CRUD + upload base64). Dados via `admin_overview` (WS) → `store.getAdminOverview()`.
- **Programa de afiliados** funcional: código + link `?ref=`, vínculo no cadastro, comissão = % do GGR dos indicados; painel do afiliado `/afiliados` (`Affiliate.tsx`).
- **Acervo de demonstração (CRM)**: `src/server/demoData.ts` gera ~160 clientes BR sintéticos com histórico realista (depósitos/saques/apostas/afiliados, ~9 meses, GGR positivo) — auto-semeado SÓ em modo `demo`, **idempotente** (marcador `data/demo-seeded.json`), aditivo (preserva contas reais), contas marcadas `demo:true`, senha `demo1234`. Faz o backoffice parecer um operador real. **Regenerar:** `npm run demo:reseed [qtd]` (`src/server/demoReseed.ts`) — remove o acervo demo antigo, gera um novo e preserva as contas reais; rode com o gateway PARADO e reinicie depois. Resetar manual: apague `data/demo-seeded.json` + as contas `demo`.
- **Performance do board ao vivo (board grande)**: (1) o gateway agrupa os updates do motor num único `matches_batch`/seg (`index.ts`) → cliente aplica em 1 render (`upsertMatches`); (2) `MatchRow` **e** `LeagueSection` (cada liga) são memoizados — `LeagueSection` compara as referências dos jogos, então só ligas com jogo alterado re-renderizam; (3) `DemoEngine` limita os jogos simultâneos ao vivo (`MAX_LIVE=32`; o resto fica pré-jogo, como num sportsbook real); (4) o board principal mostra os 160 jogos em destaque (ao vivo + próximos) com aviso "X de Y" — todos seguem acessíveis pela barra de ligas/contadores; (5) `ws.ts` guarda o socket no `window` (não vaza no HMR). Resultado: ~380 jogos no acervo, board fluido (~145ms) com 32 ao vivo rolando.
- **UI:** o "boletim" agora se chama **Bilhete** (BetSlip/MobileNav); banner (`HeroBanners`) repaginado (crossfade, Ken Burns, badge, overlay, CTA, indicadores); mercado suspenso ao vivo mostra **ícone SVG de cadeado** (`ui/Icon` "lock") em vez de emoji; ícones de esporte novos (baseball/americanfootball/icehockey) — a UI é sport-aware (`catalog.SPORT_GROUPS`, `SportsRibbon` com pílula por esporte).
- **Multi-esporte no demo:** o `DemoEngine` simula "ao vivo" SÓ no futebol (placar/minuto/gols Poisson); os demais esportes ficam **pré-jogo** com as odds reais (simular gol/90' neles seria irreal). Quando plugar o live real, cada esporte ganha sua animação.
- **Tradução PT-BR:** `lib/i18n.ts` (`ptTeam`/`ptLeague`/`ptCountry`/`ptMatchLabel`/`ptMarketName`/`ptValue`) traduz países, ligas, NOMES DE MERCADO e SELEÇÕES (Over/Under→Mais/Menos, Yes/No→Sim/Não, etc.) na exibição + nos normalizadores; nomes originais seguem para lookups/apostas. Clubes ficam iguais.
- **Todos os mercados (API-Football):** `normalizeBets` (`apiFootball.ts`) tem um passe GENÉRICO que inclui TODOS os tipos de aposta que a API retorna por jogo (placar exato, handicap, escanteios, cartões, 1º/2º tempo…), com nome/seleções traduzidos (`ptMarketName`/`ptValue`). Vale na PRÓXIMA colheita (`npm run feed:harvest 0`). Os 1x2/ou25/btts seguem com chave específica p/ liquidação.
- **Odds coerentes:** `odds.ts` `MAX_ODDS` 51→**26** (MIN 1.02) — odds do MODELO (live `liveMarkets` + synth) não passam de 26 (o "51.00" feio sumiu). Odds REAIS (API-Football/The Odds API no pré-jogo) NÃO são clampadas (são do mercado real). Live atualiza a cada poll com o placar real.
- **Fotos (crest):** `PlayerCrest` mostra a foto sobre fundo SÓLIDO (sem o monograma por baixo — o cutout transparente vazava as iniciais). `TeamCrest player` em todos os mercados (board/featured/detalhe). Verificado: 81 fotos, 0 com iniciais por cima.
- **Board/aposta (refinamentos):** "Ao Vivo" mostra TODOS os jogos ao vivo (ignora a liga selecionada); pré-jogos ordenados por horário CRESCENTE (não deixa jogo de 11/06 antes dos de hoje) + **abas de dia** estilo Betano na view Próximas (`CenterControls`, `filters.day`); pré-jogos com horário passado são escondidos. **Apostas AO VIVO levam ~10s para validar** (janela anti-fraude no servidor `handlePlaceBet`/`handlePlaceMulti`: re-checa odds/suspensão após o delay; `LIVE_BET_DELAY_MS`; cliente com timeout 15s + contagem "Validando ao vivo… Xs"). Esportes individuais (tênis/MMA/boxe) buscam **foto do atleta** (`logos.getPlayerPhoto` → TheSportsDB searchplayers) em vez de escudo; `TeamCrest` ganhou `player`.
- **Admin demo:** login `admin` / senha `admin123`.

## Limitações / pendências (próximos passos)
- **"Ao vivo" do feed real ainda é simulado**: o modo `demo` reanima jogos reais com live convincente (vitrine), mas placar/minuto reais exigem o endpoint live da API-Football (`/fixtures?live=all` + polling). Em produção, plugar o live real no `realFeed`.
- **Saque/depósito são simulados** — dinheiro real exige **gateway de pagamento** (Mercado Pago/Asaas/Efí) + KYC. Ponto isolado em `store.ts` (`deposit`/`withdraw`).
- API-Football grátis = 100 req/dia → `feed:harvest` colhe ~90 jogos com odds de ~39 ligas. Plano pago (US$10-19/mês) libera mais (subir `DAYS`/`MAX_ODDS_PAGES`/`maxOddsPages`).
- **Persistência em JSON** não escala para produção (trocar por Postgres — API do `store.ts` não muda). `data/users.json`/`bets.json` ficam grandes com o acervo demo (~1MB).
- Cashout (real) só em apostas simples + jogo ao vivo; afiliados/CRM operam sobre os dados do `getAdminOverview`.
- Vôlei/eSports: nenhum provedor atual cobre.

## Regulação (contexto de negócio)
Modelo B2B: vender software a operadores LICENCIADOS (a licença SPA/Ministério da
Fazenda — Lei 14.790/2023 — é do cliente operador, não do Gustavo). Por isso é
multi-tenant. Não é aconselhamento jurídico.

## Convenções
- Commits/PR só quando pedido. Mensagens de commit terminam com a linha Co-Authored-By padrão.
- Responder em **português (BR)**. Verificar mudanças visuais no navegador antes de concluir.
