import type { FastifyInstance } from 'fastify';
import type Stripe from 'stripe';
import { PLAN_LIMITS } from '@mpa/types';
import { stripe } from '../stripeClient.js';
import { env } from '../env.js';
import { authenticate } from '../auth.js';
import { getUser, updateUser, getUserByStripeCustomerId } from '../repositories/usersRepository.js';
import { pauseExcessMonitorsForUser } from '../repositories/monitorsRepository.js';
import { claimWebhookEvent } from '../repositories/webhookEventsRepository.js';

/**
 * Checkout, Customer Portal e webhook do Stripe (Fase 6). Ver
 * _local-adr-policy-003.
 */
export async function billingRoutes(app: FastifyInstance) {
  app.post('/billing/checkout', { preHandler: authenticate }, async (request, reply) => {
    if (!stripe || !env.STRIPE_PRICE_ID_PRO) {
      return reply.status(503).send({ error: 'Cobrança via Stripe não configurada neste ambiente' });
    }

    const user = await getUser(request.userId);
    const appUrl = env.APP_URL ?? 'http://localhost:5173';

    // Trial de 10 dias — só para quem nunca assinou antes (checado via
    // stripeSubscriptionId já gravado), para fechar o loop óbvio de
    // cancelar e reassinar em busca de trial infinito. Ver
    // _local-adr-policy-003.
    const isFirstSubscription = !user?.stripeSubscriptionId;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: request.userId,
      customer: user?.stripeCustomerId,
      customer_email: user?.stripeCustomerId ? undefined : (request.userEmail ?? undefined),
      line_items: [{ price: env.STRIPE_PRICE_ID_PRO, quantity: 1 }],
      subscription_data: isFirstSubscription ? { trial_period_days: 10 } : undefined,
      success_url: `${appUrl}/plans?checkout=success`,
      cancel_url: `${appUrl}/plans?checkout=canceled`,
    });

    return { url: session.url };
  });

  app.post('/billing/portal', { preHandler: authenticate }, async (request, reply) => {
    if (!stripe) {
      return reply.status(503).send({ error: 'Cobrança via Stripe não configurada neste ambiente' });
    }

    const user = await getUser(request.userId);
    if (!user?.stripeCustomerId) {
      return reply.status(400).send({ error: 'Usuário ainda não tem uma assinatura Stripe' });
    }

    const appUrl = env.APP_URL ?? 'http://localhost:5173';
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl}/profile`,
    });

    return { url: session.url };
  });

  // Escopo isolado: só esta rota precisa do corpo bruto (não parseado)
  // para verificar a assinatura Stripe — o parser customizado não
  // vaza para o resto do app graças ao encapsulamento de plugins do
  // Fastify.
  await app.register(async (webhookApp) => {
    webhookApp.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => {
      done(null, body);
    });

    webhookApp.post('/webhooks/stripe', async (request, reply) => {
      if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
        return reply.status(503).send({ error: 'Webhook Stripe não configurado neste ambiente' });
      }

      const signature = request.headers['stripe-signature'];
      if (!signature || typeof signature !== 'string') {
        return reply.status(400).send({ error: 'Assinatura Stripe ausente' });
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(request.body as Buffer, signature, env.STRIPE_WEBHOOK_SECRET);
      } catch (error) {
        request.log.warn({ err: error }, 'Assinatura de webhook Stripe inválida');
        return reply.status(400).send({ error: 'Assinatura inválida' });
      }

      const isNewEvent = await claimWebhookEvent(event.id);
      if (!isNewEvent) {
        return { received: true, deduped: true };
      }

      await handleStripeEvent(event);
      return { received: true };
    });
  });
}

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.client_reference_id;
      if (!uid) break;
      await updateUser(uid, {
        plan: 'pro',
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
        stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
      });
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
      const user = await getUserByStripeCustomerId(customerId);
      if (!user) break;

      const isActive = event.type === 'customer.subscription.updated' && (subscription.status === 'active' || subscription.status === 'trialing');
      const newPlan = isActive ? 'pro' : 'free';

      await updateUser(user.uid, { plan: newPlan, stripeSubscriptionId: subscription.id });
      if (newPlan === 'free') {
        await pauseExcessMonitorsForUser(user.uid, PLAN_LIMITS.free.maxMonitors);
      }
      break;
    }
    default:
      break;
  }
}
