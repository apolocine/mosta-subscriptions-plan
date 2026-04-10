// @mostajs/subscriptions-plan — Subscribe to plan (multi-provider)
// Author: Dr Hamid MADANI drmdh@msn.com
// Delegates payment to @mostajs/payment providers

import type { IDialect } from '@mostajs/orm'
import { getPlanRepo, getSubscriptionRepo } from './plan-factory.js'

export interface SubscribeParams {
  accountId: string
  planId: string
  /** Payment provider: 'direct' (free/manual), 'stripe', 'chargily', 'paypal', 'satim' */
  provider?: string
  /** URLs for payment redirect */
  successUrl?: string
  cancelUrl?: string
  /** Webhook URL for payment provider callback */
  webhookUrl?: string
  /** Customer info (for provider checkout) */
  customerEmail?: string
  customerName?: string
  /** Stripe customer ID (if already exists) */
  stripeCustomerId?: string
}

export interface SubscribeResult {
  ok: boolean
  /** If payment required, redirect URL */
  url?: string | null
  /** If direct subscription (free plan), the subscription object */
  subscription?: any
  /** Error message */
  error?: string
}

/**
 * Subscribe to a plan — handles free (direct) and paid (via payment provider).
 *
 * - Free plan (price=0): creates subscription directly in DB
 * - Paid plan: delegates to @mostajs/payment provider for checkout redirect
 * - Falls back to direct subscription if no provider available
 */
export async function subscribeToPlan(
  dialect: IDialect,
  params: SubscribeParams,
): Promise<SubscribeResult> {
  const planRepo = getPlanRepo(dialect)
  const subRepo = getSubscriptionRepo(dialect)

  // Verify plan exists
  const plan = await planRepo.findById(params.planId) as any
  if (!plan) return { ok: false, error: 'Plan non trouve' }

  // Free plan or no provider → direct subscription
  if (!plan.price || plan.price === 0 || !params.provider || params.provider === 'direct') {
    return directSubscribe(subRepo, params.accountId, params.planId)
  }

  // Paid plan → try payment provider
  try {
    const { getProvider, registerProvider } = await import('@mostajs/payment/server')

    // Auto-register provider if not done yet
    await ensureProvider(params.provider)

    const provider = getProvider(params.provider)

    const result = await provider.createCheckout({
      orderId: `sub_${params.accountId}_${params.planId}`,
      amount: plan.price / 100, // cents → units
      currency: plan.currency ?? 'usd',
      description: `Abonnement ${plan.name}`,
      successUrl: params.successUrl ?? '/dashboard/billing?success=1',
      cancelUrl: params.cancelUrl ?? '/dashboard/billing?canceled=1',
      webhookUrl: params.webhookUrl,
      customerId: params.stripeCustomerId,
      priceId: plan.stripePriceId,
      metadata: { accountId: params.accountId, planId: params.planId },
    })

    return { ok: true, url: result.url }
  } catch (e: any) {
    console.warn(`[subscribe] Provider ${params.provider} failed:`, e.message)
    return { ok: false, error: e.message }
  }
}

/**
 * Direct subscription — no payment required (free plan or fallback).
 */
async function directSubscribe(subRepo: any, accountId: string, planId: string): Promise<SubscribeResult> {
  // Cancel existing active subscriptions
  const existing = await subRepo.findAll({ account: accountId, status: 'active' })
  for (const sub of existing) {
    await subRepo.update(sub.id, { status: 'canceled' } as any)
  }

  // Create new subscription
  const subscription = await subRepo.create({
    account: accountId,
    plan: planId,
    status: 'active',
  } as any)

  return { ok: true, subscription }
}

/**
 * Auto-register a payment provider from environment variables.
 */
async function ensureProvider(name: string): Promise<void> {
  const { listProviders } = await import('@mostajs/payment/server')
  if (listProviders().includes(name)) return

  switch (name) {
    case 'stripe': {
      if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured')
      const { createStripeProvider, registerProvider } = await import('@mostajs/payment/server')
      registerProvider(createStripeProvider())
      break
    }
    case 'chargily': {
      if (!process.env.CHARGILY_API_KEY) throw new Error('CHARGILY_API_KEY not configured')
      const { createChargilyProvider, registerProvider } = await import('@mostajs/payment/server')
      registerProvider(createChargilyProvider())
      break
    }
    case 'paypal': {
      if (!process.env.PAYPAL_CLIENT_ID) throw new Error('PAYPAL_CLIENT_ID not configured')
      const { createPayPalProvider, registerProvider } = await import('@mostajs/payment/server')
      registerProvider(createPayPalProvider())
      break
    }
    case 'satim': {
      if (!process.env.SATIM_MERCHANT_ID) throw new Error('SATIM_MERCHANT_ID not configured')
      const { createSatimProvider, registerProvider } = await import('@mostajs/payment/server')
      registerProvider(createSatimProvider())
      break
    }
    default:
      throw new Error(`Unknown payment provider: ${name}`)
  }
}

/**
 * Cancel current subscription and downgrade to Free plan.
 *
 * @param dialect - ORM dialect
 * @param accountId - Account to cancel
 * @returns { ok, subscription } with the new Free subscription
 */
export async function cancelCurrentSubscription(
  dialect: import('@mostajs/orm').IDialect,
  accountId: string,
): Promise<SubscribeResult> {
  const subRepo = getSubscriptionRepo(dialect)
  const planRepo = getPlanRepo(dialect)

  // Cancel all active subscriptions
  const active = await subRepo.findAll({ account: accountId, status: 'active' })
  for (const sub of active) {
    await subRepo.update((sub as any).id, { status: 'canceled' } as any)
  }

  // Auto-subscribe to Free plan
  const freePlans = await planRepo.findAll({ slug: 'free' })
  if (freePlans.length === 0) {
    return { ok: true } // No free plan defined
  }

  const subscription = await subRepo.create({
    account: accountId,
    plan: (freePlans[0] as any).id,
    status: 'active',
  } as any)

  return { ok: true, subscription }
}
