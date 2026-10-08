---
name: _local-bdr-policy-017-fim-da-ficcao-de-sites-pesquisados
description: Remove o conceito de "sites pesquisados" (trackedSites, coleção mpa_sites, caixas de seleção, lista de sites monitorados). O scan sempre consultou só Travelpayouts e Sky Scrapper; a escolha de LATAM/GOL/Azul/Decolar/Skyscanner nunca controlou nada. Use ao mexer em MonitorForm, EditMonitorModal, MonitorCard, dashboard, FlightMonitor ou ao pensar em adicionar uma "fonte" ao formulário.
apply-to: apps/web (MonitorForm, EditMonitorModal, MonitorCard, MonitorDetailModal, dashboard), services/api (routes/monitors, firestore COLLECTIONS), packages/types (FlightMonitor, AirlineSite)
valid-from: 2026-10-08
---

# _local-bdr-policy-017: Fim da ficção de "sites pesquisados"

## Context and Problem Statement

O formulário de monitor oferecia caixas "Pesquisar nos seguintes sites" (LATAM, GOL, Azul,
Decolar, Skyscanner), a tela mostrava a lista "Sites monitorados" com liga/desliga, e cada
monitor guardava `trackedSites`. Nada disso influenciava o scan: `executeScan` consulta uma
cascata fixa de fontes reais (Travelpayouts e, sem cobertura, Sky Scrapper) e nunca leu
`trackedSites`. O campo `site` de cada resultado vem da própria fonte (agência de venda ou
companhia), não da seleção do usuário.

A `_local-bdr-policy-016` já registrava isso como dívida conhecida ("o conceito de
`trackedSites` continua sendo ficção") e adiou a remoção por ser redesenho de UX. O dono do
produto decidiu fechar a dívida: manter só o que é real. Ao tentar adicionar mais um site
(passagensimperdiveis.com.br) a lista, ficou claro que cada site novo seria mais uma caixa sem
efeito, com um formato de link de compra não verificado.

## Decision Outcome

**O FlySpot não oferece mais escolha de site. O que o usuário configura é rota, datas,
passageiros, meta e margem; quem apura o preço é a cascata de fontes reais, e a notificação
aponta para o vendedor que de fato ofereceu a tarifa.**

### O que sai

- Caixas de seleção de sites no `MonitorForm` e no `EditMonitorModal`.
- Selo/lista de sites no `MonitorCard` e no cabeçalho do `MonitorDetailModal`.
- `SitesList` ("Sites monitorados") e o liga/desliga de site no dashboard.
- Rotas `GET /api/sites` e `POST /api/sites/:id/toggle`, `sitesRepository`, `seed.ts`, o
  script `npm run seed` e o workflow `seed-sites.yml`.
- `FlightMonitor.trackedSites`, o tipo `AirlineSite` e `COLLECTIONS.sites`.
- O link de compra de `passagensimperdiveis` (nunca chegou a ser usado em produção).

### Details

- **Compatibilidade**: o schema Zod do `POST/PATCH /api/monitors` ignora campos
  desconhecidos, então clientes antigos que ainda enviem `trackedSites` não quebram.
- **Dados existentes**: monitores já gravados mantêm o campo `trackedSites` no Firestore, sem
  efeito. A coleção `mpa_sites` fica órfã e pode ser apagada pelo console quando o dono
  quiser; nenhum código a lê.
- **`purchaseLink.ts` permanece**: o `site` que ele recebe vem da fonte real, não de seleção.
- **Frontend Vite antigo (`src/`)**: descontinuado e não publicado; ganhou uma definição local
  de `AirlineSite`/`trackedSites` em `src/types.ts` apenas para continuar compilando, até ser
  removido.
- **Adicionar uma fonte no futuro** significa integrar uma fonte de dados real ao scan (com
  política própria), não adicionar uma caixa ao formulário.

### Consequences

O formulário fica menor e deixa de sugerir um controle que não existia. Quem esperava
"escolher onde pesquisar" passa a ver que a cobertura é decidida pelas fontes reais — o que é
consistente com a `_local-bdr-policy-016`.

## References

- `_local-bdr-policy-016` — registrou `trackedSites` como dívida conhecida; esta política a
  quita
- `_local-adr-policy-004` (application) — a cascata de fontes reais, inalterada
