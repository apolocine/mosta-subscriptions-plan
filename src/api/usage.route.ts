// @mostajs/subscriptions-plan — Usage API route handlers
// Author: Dr Hamid MADANI drmdh@msn.com

import type { IDialect } from '@mostajs/orm'
import { getUsageLogRepo } from '../lib/plan-factory.js'
import { getUsageSummary, incrementUsage } from '../lib/quota-check.js'

/**
 * Create handlers for usage tracking.
 */
export function createUsageHandlers(dialect: IDialect) {

  /** GET /usage?accountId=...&from=... — usage summary */
  async function GET(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const accountId = url.searchParams.get('accountId')
    if (!accountId) {
      return Response.json({ error: 'accountId required' }, { status: 400 })
    }

    const from = url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10)
    const summary = await getUsageSummary(dialect, accountId, from)
    return Response.json(summary)
  }

  /** GET /usage/today?accountId=... — today's usage */
  async function GETToday(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const accountId = url.searchParams.get('accountId')
    if (!accountId) {
      return Response.json({ error: 'accountId required' }, { status: 400 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const repo = getUsageLogRepo(dialect)
    const logs = await repo.findAll({ account: accountId, date: today })

    if (logs.length === 0) {
      return Response.json({ date: today, requests: 0, reads: 0, writes: 0, errors: 0, bandwidth: 0 })
    }

    return Response.json(logs[0])
  }

  /** POST /usage/increment — fire-and-forget usage increment */
  async function POST(req: Request): Promise<Response> {
    const body = await req.json() as {
      accountId: string
      projectId?: string
      type: 'read' | 'write' | 'error'
    }

    if (!body.accountId || !body.type) {
      return Response.json({ error: 'accountId and type required' }, { status: 400 })
    }

    // Fire-and-forget
    incrementUsage(dialect, body.accountId, body.projectId, body.type).catch(() => {})

    return Response.json({ ok: true })
  }

  return { GET, GETToday, POST }
}
