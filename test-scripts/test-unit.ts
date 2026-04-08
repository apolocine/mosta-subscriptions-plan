// @mostajs/subscriptions-plan — Tests unitaires (SQLite :memory:)
// Author: Dr Hamid MADANI drmdh@msn.com

import { createIsolatedDialect, registerSchemas, clearRegistry } from '@mostajs/orm'
import type { EntitySchema, IDialect } from '@mostajs/orm'
import { PlanSchema } from '../src/schemas/plan.schema.js'
import { SubscriptionSchema } from '../src/schemas/subscription.schema.js'
import { InvoiceSchema } from '../src/schemas/invoice.schema.js'
import { UsageLogSchema } from '../src/schemas/usage-log.schema.js'
import {
  getPlanRepo, getSubscriptionRepo, getInvoiceRepo, getUsageLogRepo, resetRepos,
} from '../src/lib/plan-factory.js'
import {
  checkQuota, isDialectAllowed, isTransportAllowed, incrementUsage, DEFAULT_PLANS,
} from '../src/lib/quota-check.js'
import type { PlanLimits } from '../src/types/index.js'

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) { passed++; console.log('  ✅', label) }
  else { failed++; console.error('  ❌', label) }
}

// Dummy Account schema (minimal, for FK relations)
const AccountSchema: EntitySchema = {
  name: 'Account',
  collection: 'accounts',
  fields: {
    email: { type: 'string', required: true },
    name:  { type: 'string', required: true },
  },
  relations: {},
  indexes: [],
  timestamps: true,
}

// Dummy Project schema (for UsageLog FK)
const ProjectSchema: EntitySchema = {
  name: 'Project',
  collection: 'projects',
  fields: {
    name: { type: 'string', required: true },
    slug: { type: 'string', required: true },
  },
  relations: {},
  indexes: [],
  timestamps: true,
}

async function run() {
  // Setup: register all schemas + create isolated dialect
  clearRegistry()
  registerSchemas([AccountSchema, ProjectSchema, PlanSchema, SubscriptionSchema, InvoiceSchema, UsageLogSchema])

  const dialect = await createIsolatedDialect(
    { dialect: 'sqlite', uri: ':memory:', schemaStrategy: 'create' },
    [AccountSchema, ProjectSchema, PlanSchema, SubscriptionSchema, InvoiceSchema, UsageLogSchema],
  )

  resetRepos()

  // ── T1 — Schemas valid ──
  console.log('T1 — Schemas valid')
  assert(PlanSchema.name === 'Plan', 'PlanSchema.name === Plan')
  assert(PlanSchema.collection === 'plans', 'PlanSchema.collection === plans')
  assert(SubscriptionSchema.name === 'Subscription', 'SubscriptionSchema.name')
  assert(InvoiceSchema.name === 'Invoice', 'InvoiceSchema.name')
  assert(UsageLogSchema.name === 'UsageLog', 'UsageLogSchema.name')
  assert(Object.keys(PlanSchema.fields).length === 10, 'Plan has 10 fields')
  assert(Object.keys(SubscriptionSchema.relations).length === 2, 'Subscription has 2 relations')
  assert(Object.keys(InvoiceSchema.relations).length === 2, 'Invoice has 2 relations')
  assert(Object.keys(UsageLogSchema.relations).length === 2, 'UsageLog has 2 relations')
  console.log('')

  // ── T2 — CRUD Plan ──
  console.log('T2 — CRUD Plan')
  const planRepo = getPlanRepo(dialect)

  // Seed default plans
  for (const p of DEFAULT_PLANS) {
    await planRepo.create(p as any)
  }

  const allPlans = await planRepo.findAll()
  assert(allPlans.length === 3, 'seed → 3 plans')
  assert(allPlans.some((p: any) => p.slug === 'free'), 'has Free plan')
  assert(allPlans.some((p: any) => p.slug === 'medium'), 'has Medium plan')
  assert(allPlans.some((p: any) => p.slug === 'premium'), 'has Premium plan')

  const freePlan = allPlans.find((p: any) => p.slug === 'free')!
  assert((freePlan as any).price === 0, 'Free plan price = 0')
  assert((freePlan as any).active === true || (freePlan as any).active === 1, 'Free plan active')

  // Create custom plan
  const customPlan = await planRepo.create({
    name: 'Enterprise', slug: 'enterprise', price: 29900, currency: 'usd', interval: 'month',
    limits: { maxProjects: 50, maxApiKeys: 100, requestsPerDay: -1, maxPoolSize: 500, dialects: '*', transports: '*', replication: true },
    features: ['50 projets', 'Illimite', 'Support dedie'],
    active: true, sortOrder: 3,
  } as any)
  assert(customPlan !== null, 'custom plan created')
  assert((customPlan as any).slug === 'enterprise', 'custom plan slug = enterprise')

  // Update plan
  const updated = await planRepo.update((customPlan as any).id, { price: 34900 } as any)
  assert((updated as any).price === 34900, 'plan updated price = 34900')

  // Deactivate plan
  const deactivated = await planRepo.update((customPlan as any).id, { active: false } as any)
  assert((deactivated as any).active === false || (deactivated as any).active === 0, 'plan deactivated')

  const activePlans = await planRepo.findAll({ active: true })
  assert(activePlans.length === 3, 'active plans = 3 (enterprise deactivated)')
  console.log('')

  // ── T3 — CRUD Subscription ──
  console.log('T3 — CRUD Subscription')

  // Create a test account
  const { BaseRepository } = await import('@mostajs/orm')
  const accountRepo = new BaseRepository(AccountSchema, dialect)
  const account = await accountRepo.create({ email: 'alice@test.com', name: 'Alice' } as any)
  const accountId = (account as any).id

  const subRepo = getSubscriptionRepo(dialect)

  // Create subscription linked to Free plan
  const sub = await subRepo.create({
    account: accountId,
    plan: (freePlan as any).id,
    status: 'active',
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
  } as any)
  assert(sub !== null, 'subscription created')
  assert((sub as any).status === 'active', 'subscription status = active')

  // Upgrade to Medium
  const mediumPlan = allPlans.find((p: any) => p.slug === 'medium')!
  await subRepo.update((sub as any).id, { status: 'canceled' } as any)
  const sub2 = await subRepo.create({
    account: accountId,
    plan: (mediumPlan as any).id,
    status: 'active',
  } as any)
  assert((sub2 as any).status === 'active', 'upgraded subscription active')

  const canceledSubs = await subRepo.findAll({ account: accountId, status: 'canceled' })
  assert(canceledSubs.length === 1, 'old subscription canceled')
  console.log('')

  // ── T4 — CRUD Invoice ──
  console.log('T4 — CRUD Invoice')
  const invRepo = getInvoiceRepo(dialect)

  const inv1 = await invRepo.create({
    account: accountId,
    subscription: (sub2 as any).id,
    amount: 2900,
    currency: 'usd',
    status: 'paid',
    paidAt: new Date().toISOString(),
    pdfUrl: 'https://stripe.com/invoice/123.pdf',
  } as any)
  assert(inv1 !== null, 'invoice created')
  assert((inv1 as any).amount === 2900, 'invoice amount = 2900')

  const inv2 = await invRepo.create({
    account: accountId,
    amount: 2900,
    currency: 'usd',
    status: 'open',
  } as any)

  const paidInvoices = await invRepo.findAll({ status: 'paid' })
  assert(paidInvoices.length === 1, 'paid invoices = 1')

  const allInvoices = await invRepo.findAll({ account: accountId })
  assert(allInvoices.length === 2, 'total invoices = 2')
  console.log('')

  // ── T5 — Usage tracking ──
  console.log('T5 — Usage tracking')

  await incrementUsage(dialect, accountId, undefined, 'read')
  await incrementUsage(dialect, accountId, undefined, 'write')
  await incrementUsage(dialect, accountId, undefined, 'read')

  const usageRepo = getUsageLogRepo(dialect)
  const today = new Date().toISOString().slice(0, 10)
  const todayLogs = await usageRepo.findAll({ account: accountId, date: today })
  assert(todayLogs.length === 1, 'usage log created for today')
  assert((todayLogs[0] as any).requests === 3, 'requests = 3')
  assert((todayLogs[0] as any).reads === 2, 'reads = 2')
  assert((todayLogs[0] as any).writes === 1, 'writes = 1')

  // Increment more
  await incrementUsage(dialect, accountId, undefined, 'error')
  const todayLogs2 = await usageRepo.findAll({ account: accountId, date: today })
  assert((todayLogs2[0] as any).requests === 4, 'requests = 4 after error')
  assert((todayLogs2[0] as any).errors === 1, 'errors = 1')
  console.log('')

  // ── T6 — Quota enforcement ──
  console.log('T6 — Quota enforcement')

  // Medium plan: 50000 requests/day, 5 projects, 5 API keys
  const quotaReq = await checkQuota(dialect, accountId, 'requests')
  assert(quotaReq.allowed === true, 'requests quota: allowed (4 < 50000)')
  assert(quotaReq.current === 4, 'requests quota: current = 4')
  assert(quotaReq.limit === 50000, 'requests quota: limit = 50000')

  const quotaProj = await checkQuota(dialect, accountId, 'projects', 2)
  assert(quotaProj.allowed === true, 'projects quota: 2 < 5 allowed')

  const quotaProjFull = await checkQuota(dialect, accountId, 'projects', 5)
  assert(quotaProjFull.allowed === false, 'projects quota: 5 >= 5 denied')
  assert(quotaProjFull.reason === 'Project limit reached', 'denial reason correct')

  const quotaKeys = await checkQuota(dialect, accountId, 'apiKeys', 3)
  assert(quotaKeys.allowed === true, 'apiKeys quota: 3 < 5 allowed')
  console.log('')

  // ── T7 — Plan limits helpers ──
  console.log('T7 — Plan limits helpers')

  const freeLimits = (freePlan as any).limits as PlanLimits
  assert(isDialectAllowed(freeLimits, 'sqlite'), 'Free: sqlite allowed')
  assert(isDialectAllowed(freeLimits, 'postgres'), 'Free: postgres allowed')
  assert(!isDialectAllowed(freeLimits, 'mysql'), 'Free: mysql NOT allowed')
  assert(!isDialectAllowed(freeLimits, 'oracle'), 'Free: oracle NOT allowed')

  assert(isTransportAllowed(freeLimits, 'rest'), 'Free: rest allowed')
  assert(isTransportAllowed(freeLimits, 'mcp'), 'Free: mcp allowed')
  assert(!isTransportAllowed(freeLimits, 'graphql'), 'Free: graphql NOT allowed')

  const premiumLimits = (allPlans.find((p: any) => p.slug === 'premium') as any).limits as PlanLimits
  assert(isDialectAllowed(premiumLimits, 'oracle'), 'Premium: oracle allowed (wildcard)')
  assert(isTransportAllowed(premiumLimits, 'grpc'), 'Premium: grpc allowed (wildcard)')
  console.log('')

  // ── Cleanup ──
  await dialect.disconnect()
  clearRegistry()
  resetRepos()

  // ── Summary ──
  console.log('════════════════════════════════════════')
  console.log(`  Resultats: ${passed} passed, ${failed} failed`)
  console.log('════════════════════════════════════════')
  if (failed > 0) process.exit(1)
}

run().catch(e => { console.error('❌ Fatal:', e.message); process.exit(1) })
