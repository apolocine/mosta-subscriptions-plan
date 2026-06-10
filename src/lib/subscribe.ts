// @mostajs/subscriptions-plan — Subscribe to plan (multi-provider)
// Author: Dr Hamid MADANI drmdh@msn.com
// Delegates payment to @mostajs/payment providers

import type { IDialect } from '@mostajs/data-plug'
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
  /**
   * Scope optionnel de l'abonnement. Par défaut { type:'account' } (historique).
   * { type:'course', id:courseId } → abo rattaché à une course (race-event) : permet
   * PLUSIEURS abos actifs par compte, un par entité scopée. L'annulation des abos
   * existants ne touche que le MÊME scope.
   */
  scope?: { type: string; id: string }
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
    return directSubscribe(subRepo, params.accountId, params.planId, params.scope)
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
      metadata: {
        accountId: params.accountId,
        planId: params.planId,
        ...(params.scope ? { scopeType: params.scope.type, scopeId: params.scope.id } : {}),
      },
    })

    return { ok: true, url: result.url }
  } catch (e: any) {
    console.warn(`[subscribe] Provider ${params.provider} failed:`, e.message)
    return { ok: false, error: e.message }
  }
}

/**
 * Direct subscription — no payment required (free plan or fallback).
 *
 * Scope-aware : si un scope est fourni (ex. course), seuls les abos actifs du
 * MÊME scope sont annulés (un compte peut sponsoriser plusieurs courses en //).
 * Sans scope → comportement historique (annule les abos actifs du compte).
 */
async function directSubscribe(
  subRepo: any,
  accountId: string,
  planId: string,
  scope?: { type: string; id: string },
): Promise<SubscribeResult> {
  // Cancel existing active subscriptions of the SAME scope
  const filter: any = { account: accountId, status: 'active' }
  if (scope) { filter.scopeType = scope.type; filter.scopeId = scope.id }
  const existing = await subRepo.findAll(filter)
  for (const sub of existing) {
    await subRepo.update(sub.id, { status: 'canceled' } as any)
  }

  // Create new subscription
  const subscription = await subRepo.create({
    account: accountId,
    plan: planId,
    status: 'active',
    ...(scope ? { scopeType: scope.type, scopeId: scope.id } : {}),
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
      // Cohérence Stripe-aligned : CHARGILY_SECRET_KEY (recommandé) avec
      // fallback CHARGILY_API_KEY (legacy). Cf. createChargilyProvider.
      const { getEnv } = await import('@mostajs/config')
      const chargilyKey = getEnv('CHARGILY_SECRET_KEY') ?? getEnv('CHARGILY_API_KEY')
      if (!chargilyKey) throw new Error('CHARGILY_SECRET_KEY not configured')
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
  dialect: import('@mostajs/data-plug').IDialect,
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

/**
 * Trouve l'abonnement ACTIF pour un scope donné.
 *
 * - `{ accountId }` seul → abo actif du compte (historique).
 * - `{ scope:{type,id} }` → abo actif rattaché à cette entité (ex. course).
 *   `accountId` reste optionnel pour restreindre au compte.
 *
 * @returns la Subscription active ou `null`.
 */
export async function findActiveSubscription(
  dialect: import('@mostajs/data-plug').IDialect,
  params: { accountId?: string; scope?: { type: string; id: string } },
): Promise<any | null> {
  const subRepo = getSubscriptionRepo(dialect)
  const filter: any = { status: 'active' }
  if (params.accountId) filter.account = params.accountId
  if (params.scope) { filter.scopeType = params.scope.type; filter.scopeId = params.scope.id }
  const rows = await subRepo.findAll(filter)
  return rows && rows.length > 0 ? rows[0] : null
}
