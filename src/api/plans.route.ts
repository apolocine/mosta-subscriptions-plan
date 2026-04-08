// @mostajs/subscriptions-plan — Plans API route handlers
// Author: Dr Hamid MADANI drmdh@msn.com

import type { IDialect } from '@mostajs/orm'
import { getPlanRepo } from '../lib/plan-factory.js'
import type { PlanDTO } from '../types/index.js'

type PermissionChecker = (permission: string) => Promise<{
  error: Response | null
  session: unknown
}>

/**
 * Create CRUD handlers for Plans.
 * GET is public (pricing page). POST/PUT/DELETE require admin permission.
 */
export function createPlanHandlers(dialect: IDialect, checkPermission?: PermissionChecker) {
  const repo = getPlanRepo(dialect)

  /** GET /plans — list active plans (public) */
  async function GET(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const all = url.searchParams.get('all') === 'true'

    const filter = all ? {} : { active: true }
    const plans = await repo.findAll(filter, { sort: { sortOrder: 1 } })
    return Response.json(plans)
  }

  /** POST /plans — create plan (admin) */
  async function POST(req: Request): Promise<Response> {
    if (checkPermission) {
      const { error } = await checkPermission('cloud.admin.plans')
      if (error) return error
    }

    const data = await req.json() as Partial<PlanDTO>
    if (!data.name || !data.slug || data.price === undefined || !data.limits) {
      return Response.json(
        { error: 'name, slug, price and limits are required' },
        { status: 400 },
      )
    }

    // Check slug uniqueness
    const existing = await repo.findAll({ slug: data.slug })
    if (existing.length > 0) {
      return Response.json(
        { error: `Plan with slug "${data.slug}" already exists` },
        { status: 409 },
      )
    }

    const plan = await repo.create(data)
    return Response.json(plan, { status: 201 })
  }

  /** PUT /plans/:id — update plan (admin) */
  async function PUT(req: Request, id: string): Promise<Response> {
    if (checkPermission) {
      const { error } = await checkPermission('cloud.admin.plans')
      if (error) return error
    }

    const data = await req.json() as Partial<PlanDTO>
    const plan = await repo.update(id, data)
    if (!plan) {
      return Response.json({ error: 'Plan not found' }, { status: 404 })
    }
    return Response.json(plan)
  }

  /** DELETE /plans/:id — deactivate plan (admin, soft) */
  async function DELETE(req: Request, id: string): Promise<Response> {
    if (checkPermission) {
      const { error } = await checkPermission('cloud.admin.plans')
      if (error) return error
    }

    const plan = await repo.update(id, { active: false } as Partial<PlanDTO>)
    if (!plan) {
      return Response.json({ error: 'Plan not found' }, { status: 404 })
    }
    return Response.json({ ok: true, deactivated: id })
  }

  return { GET, POST, PUT, DELETE }
}
