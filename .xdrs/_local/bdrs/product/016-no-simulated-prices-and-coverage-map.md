---
name: _local-bdr-policy-016-no-simulated-prices-and-coverage-map
description: O FlySpot deixa de fabricar preço. Todo número exibido vem de fonte real ou não é exibido; ausência de dado é resultado legítimo, não erro. Acompanha um mapa de cobertura em lote no /admin para medir o tamanho real do produto possível. Use ao mexer em executeScan, itinerarySearch, routeStats, travelpayoutsClient, ScanResult/ScanResponse ou em qualquer tela que mostre preço.
apply-to: services/api (executeScan, itinerarySearch, routeStats, travelpayoutsClient, executeItineraryScan, routes/admin, repositories/monitorsRepository), packages/types (ScanResult, ScanResponse, ItineraryLeg, FlightMonitor), apps/web (MonitorCard, MonitorDetailModal, MonitorForm, SitesList, admin)
valid-from: 2026-08-07
---

# _local-bdr-policy-016: Fim do preço simulado + mapa de cobertura real

## Context and Problem Statement

O FlySpot prometia três coisas ao mesmo tempo: **qualquer rota**, **preço real** e
**vigilância contínua**. Da `_local-bdr-plan-002` até a `_local-bdr-policy-015`, cinco
tentativas de sustentar as três esbarraram na mesma parede por motivos diferentes — Duffel
recusa empresa brasileira no self-service; o portal self-service da Amadeus foi
descontinuado; o Travelpayouts entrega dado real mas só de cache, com cobertura estreita; o
Sky Scrapper esgotou a cota do plano gratuito; e o navegador headless da
`_local-bdr-policy-015` bateu numa checagem anti-bot do PerimeterX no primeiro clique real em
produção (tela "Are you a person or a robot? PRESS & HOLD"), que este projeto decidiu não
tentar contornar.

Enquanto isso, o produto preenchia o vazio com números inventados. O simulador Gemini
(`scanSimulator.ts`) produzia preço por site para qualquer rota; `routeStats.ts` pedia ao
modelo que "estimasse" média/mínimo/máximo, com um fallback offline que multiplicava um
preço-base por um fator de passageiros; `itinerarySearch.ts` precificava trecho sem cobertura
pelo simulador; o scan incrementava contador de varredura e gravava tempo de resposta
aleatório para sites que nunca foram consultados. Um selo "Simulado" tentava sinalizar a
diferença na tela.

O selo não resolve o problema, e por duas razões. A primeira é que ele transfere ao usuário
um julgamento que é nosso: quem calibra uma meta de preço contra uma média inventada tomou
uma decisão com base em nada, tenha lido a etiqueta ou não. A segunda é que a etiqueta não
alcança tudo — o total de um itinerário multi-trecho com uma perna estimada é um total
inventado, e é justamente esse total que decide se o roteiro vence a passagem direta.

O dono do produto formulou o rumo com clareza: parar de perseguir a rota universal e cobrir
bem o que dá pra cobrir de verdade. Antes de escolher qual produto isso vira, falta um número
que nunca foi medido — de que tamanho é a cobertura real disponível hoje.

## Decision Outcome

**Preço que o FlySpot não apurou deixa de existir no sistema. Não há mais variante estimada:
sem fonte real, a resposta é ausência de resultado — no tipo, no banco e na tela. Junto,
entra um mapa de cobertura em lote no `/admin` que mede quantas rotas têm preço real
disponível, para decidir o rumo do produto a partir de dado e não de aposta.**

### O que sai

- `services/scraper` inteiro, `realSearchClient.ts`, a rota `POST /api/monitors/:id/real-search`
  e o `RealSearchModal` — a `_local-bdr-policy-015` fica revogada por este documento: a
  premissa dela (um clique manual não dispara defesa anti-bot) foi testada em produção e é
  falsa.
- `scanSimulator.ts` e todo o caminho de preço simulado em `executeScan.ts`.
- A estimativa por IA em `routeStats.ts`, incluindo o fallback offline por fator de
  passageiros.
- O selo "Real"/"Simulado" no `MonitorCard` e no `MonitorDetailModal`, junto com o campo
  `estimated` de `ScanResult` e `ItineraryLeg` — sem contraparte simulada, a etiqueta não
  distingue mais nada.
- O incremento de `scrapedCount` e o `avgResponseMs` aleatório gravados a cada scan, e a
  exibição desses contadores no `SitesList`.
- Os passos fictícios do "console do robô crawler" no `MonitorCard`, que narravam conexão a
  servidores da LATAM/GOL/Azul com atraso artificial de 800ms por passo.
- `generalAnalysis` de `ScanResponse` — texto que só o simulador produzia e que nenhuma tela
  consumia.

### O que entra

- `ScanResponse.cheapestResult` passa a ser anulável. Um scan sem preço é **sucesso**, não
  erro: `lastScannedAt` avança (o scheduler reagenda normalmente), e `currentPrice`,
  `history` e `bestPriceTracked` ficam intocados. Sem preço não há meta batida, logo não há
  notificação nem e-mail.
- `FlightMonitor.lastPriceFoundAt` — quando `currentPrice` foi de fato observado, distinto de
  `lastScannedAt` (última tentativa). A distância entre os dois é o quanto o preço exibido
  está velho, informação que antes não existia porque todo scan sempre "achava" algo.
- `getRouteFareStats()` no `travelpayoutsClient` substitui a estimativa por IA: média, mínimo,
  máximo e `observations` calculados sobre as tarifas reais em cache, e `null` quando não há
  nenhuma. `GET /api/route-stats` responde 404 nesse caso, e o `MonitorForm` diz na criação
  que aquela rota ainda não tem preço real — o aviso passa a acontecer antes do cadastro, não
  depois de vários scans vazios.
- `mapCoverage()` + `GET /api/admin/coverage-map` + painel no `/admin`: varre os 20 aeroportos
  brasileiros de maior movimento em lotes de 4 e devolve rotas com preço real por origem,
  total e destinos distintos.
- `purgeSimulatedPrices()` + `POST /api/admin/purge-simulated-prices` — ver "Limpeza do
  passado" abaixo.

### Details

- **Itinerário**: `priceLeg()` devolve `null` sem cobertura, e `null` remove a aresta do grafo
  em vez de estimar. A cobertura da fonte passa a determinar quais roteiros existem. A
  ausência também é cacheada, senão uma rota descoberta repetiria a mesma chamada perdida a
  cada aresta avaliada. Em `executeItineraryScan`, sem baseline real da passagem direta não há
  recomendação: "mais barato" é uma comparação, e comparar contra número inventado produz
  recomendação inventada.
- **Limpeza do passado**: os monitores já gravados no Firestore carregam preço vindo do
  simulador. Removida a etiqueta, esses números passariam a se ler como reais — a amputação
  pela metade seria pior que o estado anterior. Como não há como distinguir documento a
  documento o que veio de fonte real, a limpeza é total (preço atual, melhor preço, histórico
  e resultados do último scan), preservando a configuração do usuário. É manual e sob demanda,
  nunca automática no boot: apagar histórico é destrutivo e irreversível, então quem dispara é
  uma pessoa com intenção explícita.
- **O que fica de IA**: `hubSuggestion.ts` continua usando o Gemini para sugerir aeroportos de
  conexão. Isso é conhecimento de malha aérea, não apuração de preço — o modelo amplia o
  espaço de busca, e quem decide a combinação mais barata segue sendo o Dijkstra sobre preços
  reais.
- **O que esta decisão não faz**: o conceito de `trackedSites` (o usuário escolher
  LATAM/GOL/Azul/Decolar) continua sendo ficção — o FlySpot consulta o Travelpayouts, que
  devolve agência de venda, e nunca esses sites. Remover isso é redesenho de UX e fica para a
  fase seguinte, junto com restringir o autocomplete às rotas cobertas. Fica registrado aqui
  como dívida conhecida, não como esquecimento.

### Consequences

Aceitas de propósito: o produto exibe menos números do que antes, e monitores em rotas sem
cobertura ficam visivelmente vazios. Isso é o custo de parar de mentir, e é preferível — um
alerta que nunca dispara é um problema de cobertura, enquanto um alerta disparado por preço
inventado é um problema de confiança.

A decisão seguinte — o que o FlySpot vira — depende do número que o mapa de cobertura
produzir, e por isso não é tomada aqui.

## References

- `_local-bdr-policy-015` — **revogada por este documento**: o scraping sob demanda foi
  testado em produção e barrado por checagem anti-bot
- `_local-bdr-policy-010` a `-014` — diagnósticos que estabeleceram o quanto as fontes reais
  disponíveis são estreitas
- `_local-adr-policy-004` (application) — a cascata de fontes reais, que continua valendo:
  muda o que acontece quando ela se esgota
- `_local-bdr-plan-002` — por que Duffel e Amadeus não eram caminho viável para uma empresa
  brasileira
