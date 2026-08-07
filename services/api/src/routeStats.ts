import type { RouteStats } from '@mpa/types';
import { getRouteFareStats } from './travelpayoutsClient.js';
import type { PassengerDateInput } from './schemas/passengerDate.js';

/**
 * Estatística de preço (média/mínima/máxima) de uma rota antes de o
 * monitor existir — consumida pelo cartão de referência no cadastro.
 *
 * Até a _local-bdr-policy-016 isto pedia ao Gemini que "estimasse" os
 * valores, com um fallback offline que multiplicava um preço-base por um
 * fator de passageiros. Os dois produziam números plausíveis e sem
 * lastro: o usuário calibrava a meta dele contra uma invenção. Agora sai
 * das tarifas reais em cache do Travelpayouts, e `null` quando não há
 * nenhuma — ausência é resposta legítima, e a tela precisa saber
 * distinguir "não sabemos" de "é barato".
 *
 * Passageiros deixaram de entrar na conta porque a fonte não devolve
 * preço por composição de passageiros: multiplicar por conta própria
 * seria reintroduzir estimativa por outra porta.
 */
export async function getRouteStats(params: PassengerDateInput): Promise<RouteStats | null> {
  return getRouteFareStats(params.origin, params.destination);
}
