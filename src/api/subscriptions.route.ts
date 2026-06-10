// @mostajs/subscriptions-plan — Subscriptions API route handlers
// Author: Dr Hamid MADANI drmdh@msn.com

import type { IDialect } from '@mostajs/data-plug'
import { getSubscriptionRepo, getPlanRepo } from '../lib/plan-factory.js'
import type { SubscriptionDTO } from '../types/index.js'

/**
 * Create handlers for subscription management.
 */
export function createSubscriptionHandlers(dialect: IDialect) {
  const subRepo = getSubscriptionRepo(dialect)
  const planRepo = getPlanRepo(dialect)

  /** GET /subscription?accountId=... — get active subscription */
  async function GET(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const accountId = url.searchParams.get('accountId')
    const scopeType = url.searchParams.get('scopeType')
    const scopeId = url.searchParams.get('scopeId')
    // Au moins un critère : compte OU scope (course, …).
    if (!accountId && !(scopeType && scopeId)) {
      return Response.json({ error: 'accountId or (scopeType & scopeId) required' }, { status: 400 })
    }

    const filter: Record<string, unknown> = { status: 'active' }
    if (accountId) filter.account = accountId
    if (scopeType && scopeId) { filter.scopeType = scopeType; filter.scopeId = scopeId }
    const subs = await subRepo.findAll(filter)
    if (subs.length === 0) {
      return Response.json(null)
    }

    // Enrich with plan details
    const sub = subs[0]
    const plan = await planRepo.findById(sub.planId)

    return Response.json({ ...sub, plan })
  }

  /** POST /subscription — create subscription (e.g., after Stripe webhook) */
  async function POST(req: Request): Promise<Response> {
    const data = await req.json() as Partial<SubscriptionDTO> & { accountId: string; planId: string }

    if (!data.accountId || !data.planId) {
      return Response.json(
        { error: 'accountId and planId are required' },
        { status: 400 },
      )
    }

    // Verify plan exists
    const plan = await planRepo.findById(data.planId)
    if (!plan) {
      return Response.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Cancel existing active subscriptions of the SAME scope (account-wide si pas de scope).
    const cancelFilter: Record<string, unknown> = { account: data.accountId, status: 'active' }
    if (data.scopeType && data.scopeId) { cancelFilter.scopeType = data.scopeType; cancelFilter.scopeId = data.scopeId }
    const existing = await subRepo.findAll(cancelFilter)
    for (const old of existing) {
      await subRepo.update(old.id, { status: 'canceled' } as Partial<SubscriptionDTO>)
    }

    // Create new subscription
    const sub = await subRepo.create({
      account: data.accountId,
      plan: data.planId,
      status: data.status ?? 'active',
      stripeSubId: data.stripeSubId,
      currentPeriodStart: data.currentPeriodStart ?? new Date().toISOString(),
      currentPeriodEnd: data.currentPeriodEnd,
      trialEnd: data.trialEnd,
      ...(data.scopeType ? { scopeType: data.scopeType } : {}),
      ...(data.scopeId ? { scopeId: data.scopeId } : {}),
    } as unknown as Partial<SubscriptionDTO>)

    return Response.json(sub, { status: 201 })
  }

  /** PUT /subscription/:id — update subscription status */
  async function PUT(req: Request, id: string): Promise<Response> {
    const data = await req.json() as Partial<SubscriptionDTO>
    const sub = await subRepo.update(id, data)
    if (!sub) {
      return Response.json({ error: 'Subscription not found' }, { status: 404 })
    }
    return Response.json(sub)
  }

  return { GET, POST, PUT }
}
