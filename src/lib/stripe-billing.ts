// @mostajs/subscriptions-plan — Stripe Billing integration
// Author: Dr Hamid MADANI drmdh@msn.com

import type Stripe from 'stripe'
import type { BillingConfig } from '../types/index.js'

/**
 * Create a Stripe Checkout session for subscription billing.
 */
export async function createBillingSession(
  stripe: Stripe,
  config: BillingConfig,
  params: {
    customerId: string
    priceId: string
    successUrl?: string
    cancelUrl?: string
    trialDays?: number
    metadata?: Record<string, string>
  },
): Promise<{ url: string | null; sessionId: string }> {
  const session = await stripe.checkout.sessions.create({
    customer: params.customerId,
    mode: 'subscription',
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl ?? config.successUrl,
    cancel_url: params.cancelUrl ?? config.cancelUrl,
    subscription_data: {
      trial_period_days: params.trialDays,
      metadata: params.metadata,
    },
    metadata: params.metadata,
  })

  return { url: session.url, sessionId: session.id }
}

/**
 * Create a Stripe Customer Portal session (manage card, invoices, cancel).
 */
export async function createPortalSession(
  stripe: Stripe,
  config: BillingConfig,
  customerId: string,
): Promise<{ url: string }> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: config.portalReturnUrl,
  })

  return { url: session.url }
}

/**
 * Create a Stripe customer for a new account.
 */
export async function createStripeCustomer(
  stripe: Stripe,
  params: { email: string; name: string; metadata?: Record<string, string> },
): Promise<string> {
  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: params.metadata,
  })
  return customer.id
}

/**
 * Cancel a Stripe subscription (at period end by default).
 */
export async function cancelSubscription(
  stripe: Stripe,
  stripeSubId: string,
  immediate: boolean = false,
): Promise<void> {
  if (immediate) {
    await stripe.subscriptions.cancel(stripeSubId)
  } else {
    await stripe.subscriptions.update(stripeSubId, {
      cancel_at_period_end: true,
    })
  }
}

/**
 * Change subscription plan (upgrade/downgrade).
 */
export async function changeSubscriptionPlan(
  stripe: Stripe,
  stripeSubId: string,
  newPriceId: string,
): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(stripeSubId)
  await stripe.subscriptions.update(stripeSubId, {
    items: [{
      id: sub.items.data[0].id,
      price: newPriceId,
    }],
    proration_behavior: 'always_invoice',
  })
}

/**
 * Verify and parse a Stripe webhook event.
 */
export function verifyWebhookEvent(
  stripe: Stripe,
  body: string | Buffer,
  signature: string,
  secret: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(body, signature, secret)
}

/**
 * Handle billing webhook events.
 * Returns the action taken for logging/auditing.
 */
export function parseBillingEvent(event: Stripe.Event): {
  type: 'subscription_created' | 'subscription_updated' | 'subscription_deleted' |
        'invoice_paid' | 'invoice_failed' | 'checkout_completed' | 'unknown'
  data: Record<string, unknown>
} {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      return {
        type: 'checkout_completed',
        data: {
          customerId: session.customer,
          subscriptionId: session.subscription,
          metadata: session.metadata,
        },
      }
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      return {
        type: event.type === 'customer.subscription.created' ? 'subscription_created' : 'subscription_updated',
        data: {
          stripeSubId: sub.id,
          customerId: sub.customer,
          status: sub.status,
          priceId: sub.items.data[0]?.price?.id,
          currentPeriodStart: new Date((sub as any).current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date((sub as any).current_period_end * 1000).toISOString(),
          cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
        },
      }
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      return {
        type: 'subscription_deleted',
        data: {
          stripeSubId: sub.id,
          customerId: sub.customer,
        },
      }
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      return {
        type: 'invoice_paid',
        data: {
          stripeInvoiceId: invoice.id,
          customerId: invoice.customer,
          subscriptionId: invoice.subscription,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          pdfUrl: invoice.invoice_pdf,
          hostedUrl: invoice.hosted_invoice_url,
          periodStart: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
          periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
        },
      }
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      return {
        type: 'invoice_failed',
        data: {
          stripeInvoiceId: invoice.id,
          customerId: invoice.customer,
          subscriptionId: invoice.subscription,
          amount: invoice.amount_due,
        },
      }
    }

    default:
      return { type: 'unknown', data: { eventType: event.type } }
  }
}
