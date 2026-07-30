import Stripe from 'stripe';
import { env } from './env.js';

/**
 * Cliente Stripe único, compartilhado entre rotas de billing e o
 * webhook. Diferente do Resend (Fase 5), aqui usamos o SDK oficial em
 * vez de um cliente fetch fino — a verificação de assinatura de
 * webhook do Stripe não é trivial de reimplementar corretamente
 * (tolerância de timestamp, múltiplas versões de assinatura). Ver
 * _local-adr-policy-003.
 */
export const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
