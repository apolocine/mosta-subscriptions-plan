// @mostajs/subscriptions-plan — Quota enforcement
// Author: Dr Hamid MADANI drmdh@msn.com

import type { IDialect } from '@mostajs/orm'
import type { PlanLimits, QuotaCheckResult, UsageLogDTO } from '../types/index.js'
import { getUsageLogRepo, getPlanRepo, getSubscriptionRepo } from './plan-factory.js'

/**
 * Check if an account is within quota for a given resource.
 */
export async function checkQuota(
  dialect: IDialect,
  accountId: string,
  resource: 'requests' | 'projects' | 'apiKeys',
  currentCount?: number,
): Promise<QuotaCheckResult> {
  // Load subscription → plan → limits
  const subRepo = getSubscriptionRepo(dialect)
  const subs = await subRepo.findAll({ account: accountId, status: 'active' })
  if (subs.length === 0) {
    return { allowed: false, reason: 'No active subscription', current: 0, limit: 0, resource }
  }

  const sub = subs[0]
  const planRepo = getPlanRepo(dialect)
  // M2O relation field: sub.plan contains the FK id (not sub.planId)
  const planId = (sub as any).plan ?? sub.planId
  const plan = await planRepo.findById(planId)
  if (!plan) {
    return { allowed: false, reason: 'Plan not found', current: 0, limit: 0, resource }
  }

  const rawLimits = plan.limits
  const limits: PlanLimits = typeof rawLimits === 'string' ? JSON.parse(rawLimits) : rawLimits as PlanLimits

  switch (resource) {
    case 'requests': {
      const limit = limits.requestsPerDay
      if (limit === -1) return { allowed: true, current: currentCount ?? 0, limit: -1, resource }

      const today = new Date().toISOString().slice(0, 10)
      const usageRepo = getUsageLogRepo(dialect)
      const usageLogs = await usageRepo.findAll({ account: accountId, date: today })
      const current = usageLogs.reduce((sum: number, u: UsageLogDTO) => sum + u.requests, 0)

      return {
        allowed: current < limit,
        current,
        limit,
        resource,
        reason: current >= limit ? 'Daily request limit reached' : undefined,
      }
    }

    case 'projects': {
      const limit = limits.maxProjects
      if (limit === -1) return { allowed: true, current: currentCount ?? 0, limit: -1, resource }
      const current = currentCount ?? 0
      return {
        allowed: current < limit,
        current,
        limit,
        resource,
        reason: current >= limit ? 'Project limit reached' : undefined,
      }
    }

    case 'apiKeys': {
      const limit = limits.maxApiKeys
      if (limit === -1) return { allowed: true, current: currentCount ?? 0, limit: -1, resource }
      const current = currentCount ?? 0
      return {
        allowed: current < limit,
        current,
        limit,
        resource,
        reason: current >= limit ? 'API key limit reached' : undefined,
      }
    }

    default:
      return { allowed: false, reason: `Unknown resource: ${resource}`, current: 0, limit: 0, resource }
  }
}

/**
 * Check if a dialect is allowed by the plan.
 */
export function isDialectAllowed(limits: PlanLimits, dialect: string): boolean {
  if (limits.dialects === '*') return true
  return limits.dialects.includes(dialect.toLowerCase())
}

/**
 * Check if a transport is allowed by the plan.
 */
export function isTransportAllowed(limits: PlanLimits, transport: string): boolean {
  if (limits.transports === '*') return true
  return limits.transports.includes(transport.toLowerCase())
}

/**
 * Get usage summary for an account (current period).
 */
export async function getUsageSummary(
  dialect: IDialect,
  accountId: string,
  periodStart: string,
): Promise<{ totalRequests: number; totalReads: number; totalWrites: number; totalErrors: number; days: number }> {
  const usageRepo = getUsageLogRepo(dialect)
  const logs = await usageRepo.findAll({
    account: accountId,
    date: { $gte: periodStart },
  })

  return {
    totalRequests: logs.reduce((s: number, l: UsageLogDTO) => s + l.requests, 0),
    totalReads: logs.reduce((s: number, l: UsageLogDTO) => s + l.reads, 0),
    totalWrites: logs.reduce((s: number, l: UsageLogDTO) => s + l.writes, 0),
    totalErrors: logs.reduce((s: number, l: UsageLogDTO) => s + l.errors, 0),
    days: logs.length,
  }
}

/**
 * Increment usage for today (fire-and-forget pattern).
 */
export async function incrementUsage(
  dialect: IDialect,
  accountId: string,
  projectId: string | undefined,
  type: 'read' | 'write' | 'error',
): Promise<void> {
  const usageRepo = getUsageLogRepo(dialect)
  const today = new Date().toISOString().slice(0, 10)

  // Find or create today's log
  const existing = await usageRepo.findAll({ account: accountId, date: today })

  if (existing.length > 0) {
    const log = existing[0]
    const update: Record<string, unknown> = { requests: log.requests + 1 }
    if (type === 'read') update.reads = log.reads + 1
    if (type === 'write') update.writes = log.writes + 1
    if (type === 'error') update.errors = log.errors + 1
    await usageRepo.update(log.id, update as any)
  } else {
    await usageRepo.create({
      account: accountId,
      project: projectId,
      date: today,
      requests: 1,
      reads: type === 'read' ? 1 : 0,
      writes: type === 'write' ? 1 : 0,
      errors: type === 'error' ? 1 : 0,
      bandwidth: 0,
    } as unknown as any)
  }
}

/**
 * Default plan seeds (Free, Medium, Premium).
 */
export const DEFAULT_PLANS = [
  {
    name: 'Free', slug: 'free', price: 0, currency: 'usd', interval: 'month',
    limits: {
      maxProjects: 1, maxApiKeys: 1, requestsPerDay: 1000,
      maxPoolSize: 5, dialects: ['sqlite', 'postgres'],
      transports: ['rest', 'mcp'], replication: false,
    } as PlanLimits,
    features: ['1 projet', '1 000 req/jour', 'REST + MCP', 'Community support'],
    active: true, sortOrder: 0,
  },
  {
    name: 'Medium', slug: 'medium', price: 2900, currency: 'usd', interval: 'month',
    limits: {
      maxProjects: 5, maxApiKeys: 5, requestsPerDay: 50000,
      maxPoolSize: 50, dialects: ['sqlite', 'postgres', 'mysql', 'mongodb', 'mariadb'],
      transports: ['rest', 'mcp', 'graphql', 'trpc', 'odata'], replication: false,
    } as PlanLimits,
    features: ['5 projets', '50 000 req/jour', '5 transports', 'Email support'],
    active: true, sortOrder: 1,
  },
  {
    name: 'Premium', slug: 'premium', price: 9900, currency: 'usd', interval: 'month',
    limits: {
      maxProjects: -1, maxApiKeys: -1, requestsPerDay: -1,
      maxPoolSize: 200, dialects: '*' as const,
      transports: '*' as const, replication: true,
    } as PlanLimits,
    features: ['Projets illimites', 'Requetes illimitees', '13 dialectes', '11 transports', 'CQRS/CDC', 'Support prioritaire'],
    active: true, sortOrder: 2,
  },
]
