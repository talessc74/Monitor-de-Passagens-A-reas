---
name: _local-bdr-policy-018-procedencia-e-base-do-preco
description: Todo preço exibido ou enviado por e-mail diz de onde veio, há quanto tempo foi visto e que ele pode não valer para as datas e passageiros do monitor. Os botões de e-mail dizem "Buscar esta rota", não "site de compra". Use ao mexer em MonitorCard, MonitorDetailModal, EmailModal, templates do publisher ou nas mensagens de notificação do executeScan.
apply-to: apps/web (MonitorCard, MonitorDetailModal, EmailModal), services/api (executeScan, travelpayoutsClient, skyScrapperClient), services/publisher (templates)
valid-from: 2026-10-09
---

# _local-bdr-policy-018: Procedência e base do preço

## Context and Problem Statement

A `_local-bdr-policy-016` tirou o preço inventado, mas o que sobrou de real ainda era
apresentado de forma mais forte do que os dados permitem. O Travelpayouts devolve a tarifa
mais barata em cache da rota, sem casar com as datas do monitor; o Sky Scrapper busca só ida
e para 1 adulto. Mesmo assim, os avisos diziam "para as datas de sua viagem", o botão do
e-mail dizia "Ir para o site de compra" (o link é uma busca da rota no Skyscanner).

## Decision Outcome

**Todo preço mostrado ao usuário carrega sua procedência: a fonte, a idade e a base ("menor
preço encontrado para a rota").** Nada nos avisos nem nos cards sugere compra, nem preço que o FlySpot
não leu de uma fonte. (O radar animado da tela vazia é ilustração do site e fica fora desta regra.)

### O que muda

- Card e detalhe do monitor mostram "Fonte: X · visto há N" (`lastPriceFoundAt`) e a frase
  de base.
- As mensagens de notificação trocam "para as datas de sua viagem" por "fonte: X" e pela nota
  de base (`PRICE_BASIS_NOTE` em `executeScan.ts`).
- O botão do e-mail e do preview passa a ser "Buscar esta rota".
- `details` de cada fonte descreve o que ela realmente mede.

### Details

- O link continua sendo gerado por `purchaseLink.ts`; só o rótulo deixou de prometer compra.
- Quando uma fonte passar a casar datas e passageiros, a nota de base deve ser revista para
  aquela fonte.

## References

- `_local-bdr-policy-016` — origem da regra de não exibir número que não foi lido de fonte real
- `_local-bdr-policy-017` — remoção da escolha de sites, que nunca controlou o scan
