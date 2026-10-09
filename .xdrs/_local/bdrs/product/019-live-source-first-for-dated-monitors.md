---
name: _local-bdr-policy-019-fonte-ao-vivo-primeiro-em-monitor-com-data
description: Monitor com data consulta primeiro o Sky Scrapper (busca ao vivo, data de ida) e usa o Travelpayouts (cache de 2 a 7 dias, sem casar datas) de reserva. Monitor sem data usa só o Travelpayouts. Use ao mexer em realFare.ts, executeScan.ts ou ao trocar a ordem das fontes de preço.
apply-to: services/api (realFare, executeScan, skyScrapperClient, travelpayoutsClient)
valid-from: 2026-10-09
---

# _local-bdr-policy-019: Fonte ao vivo primeiro em monitor com data

## Context and Problem Statement

Um aviso chegou com preço de R$ 4.195 vindo do Travelpayouts, que é cache de tarifas vistas
por outras pessoas, com retenção de 2 a 7 dias e sem casar as datas do monitor. O Sky Scrapper
busca ao vivo para a data de ida. A ordem anterior (Travelpayouts primeiro) priorizava o dado
mais velho.

## Decision Outcome

**Com `departureDate`, a ordem é Sky Scrapper, depois Travelpayouts. Sem data, só
Travelpayouts faz sentido (o Sky Scrapper exige data).** Se a primeira fonte não acha preço, a
segunda é consultada; sem preço em nenhuma, o scan termina sem resultado
(`_local-bdr-policy-016`).

### Details

- Custo aceito: mais chamadas ao RapidAPI. O plano gratuito tem cota limitada e os limites
  exatos não foram lidos; se a cota acabar, o Sky Scrapper devolve nada e o Travelpayouts
  assume, como antes.
- O Sky Scrapper busca só ida e 1 adulto, então a nota de base
  (`_local-bdr-policy-018`) continua valendo.
- A busca de itinerário com conexão (Modo Tieni) segue usando o Travelpayouts por trecho.

## References

- `_local-bdr-policy-016` — sem preço inventado
- `_local-bdr-policy-018` — procedência e base do preço
- `_local-bdr-plan-006` — spike do Sky Scrapper
