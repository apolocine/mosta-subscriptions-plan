// @mostajs/subscriptions-plan — Stripe Billing integration
// Author: Dr Hamid MADANI drmdh@msn.com
// v0.2.0: delegates to @mostajs/payment for core Stripe operations

import type Stripe from 'stripe'
import type { BillingConfig } from '../types/index.js'

// ─── Delegate to @mostajs/payment ───────────────────────────

/**
 * Create a Stripe Checkout session for subscription billing.
 * Delegates to @mostajs/payment.createBillingSession
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
  const { createBillingSession: pmBilling } = await import('@mostajs/payment/server')
  return pmBilling(stripe, {
    customerId: params.customerId,
    priceId: params.priceId,
    successUrl: params.successUrl ?? config.successUrl,
    cancelUrl: params.cancelUrl ?? config.cancelUrl,
    trialDays: params.trialDays,
    metadata: params.metadata,
  })
}

/**
 * Create a Stripe Customer Portal session.
 * Delegates to @mostajs/payment.createPortalSession
 */
export async function createPortalSession(
  stripe: Stripe,
  config: BillingConfig,
  customerId: string,
): Promise<{ url: string }> {
  const { createPortalSession: pmPortal } = await import('@mostajs/payment/server')
  return pmPortal(stripe, customerId, config.portalReturnUrl)
}

/**
 * Verify a Stripe webhook event.
 * Delegates to @mostajs/payment.handleWebhook
 */
export async function verifyWebhookEvent(
  stripe: Stripe,
  body: string | Buffer,
  signature: string,
  secret: string,
): Promise<Stripe.Event> {
  const { handleWebhook } = await import('@mostajs/payment/server')
  return handleWebhook(stripe, body, signature, secret) as Promise<Stripe.Event>
}

// ─── Subscriptions-plan specific ────────────────────────────

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
 * Cancel a Stripe subscription.
 */
export async function cancelSubscription(
  stripe: Stripe,
  stripeSubId: string,
  immediate: boolean = false,
): Promise<void> {
  if (immediate) {
    await stripe.subscriptions.cancel(stripeSubId)
  } else {
    await stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true })
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
    items: [{ id: sub.items.data[0].id, price: newPriceId }],
    proration_behavior: 'always_invoice',
  })
}

/**
 * Parse billing webhook events into structured actions.
 */
export function parseBillingEvent(event: Stripe.Event): {
  type: 'subscription_created' | 'subscription_updated' | 'subscription_deleted' |
        'invoice_paid' | 'invoice_failed' | 'checkout_completed' | 'unknown'
  data: Record<string, unknown>
} {
  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session
      return { type: 'checkout_completed', data: { customerId: s.customer, subscriptionId: s.subscription, metadata: s.metadata } }
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      return {
        type: event.type === 'customer.subscription.created' ? 'subscription_created' : 'subscription_updated',
        data: {
          stripeSubId: sub.id, customerId: sub.customer, status: sub.status,
          priceId: sub.items.data[0]?.price?.id,
          currentPeriodStart: new Date((sub as any).current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date((sub as any).current_period_end * 1000).toISOString(),
          cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
        },
      }
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      return { type: 'subscription_deleted', data: { stripeSubId: sub.id, customerId: sub.customer } }
    }
    case 'invoice.paid': {
      const inv = event.data.object as Stripe.Invoice
      return {
        type: 'invoice_paid',
        data: {
          stripeInvoiceId: inv.id, customerId: inv.customer, subscriptionId: inv.subscription,
          amount: inv.amount_paid, currency: inv.currency, pdfUrl: inv.invoice_pdf,
        },
      }
    }
    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice
      return { type: 'invoice_failed', data: { stripeInvoiceId: inv.id, customerId: inv.customer, amount: inv.amount_due } }
    }
    default:
      return { type: 'unknown', data: { eventType: event.type } }
  }
}
