// @mostajs/subscriptions-plan — Repository factories
// Author: Dr Hamid MADANI drmdh@msn.com

import { BaseRepository } from '@mostajs/orm'
import type { IDialect } from '@mostajs/orm'
import { PlanSchema } from '../schemas/plan.schema.js'
import { SubscriptionSchema } from '../schemas/subscription.schema.js'
import { InvoiceSchema } from '../schemas/invoice.schema.js'
import { UsageLogSchema } from '../schemas/usage-log.schema.js'
import type { PlanDTO, SubscriptionDTO, InvoiceDTO, UsageLogDTO } from '../types/index.js'

let planRepo: BaseRepository<PlanDTO> | null = null
let subscriptionRepo: BaseRepository<SubscriptionDTO> | null = null
let invoiceRepo: BaseRepository<InvoiceDTO> | null = null
let usageLogRepo: BaseRepository<UsageLogDTO> | null = null

export function getPlanRepo(dialect: IDialect): BaseRepository<PlanDTO> {
  if (!planRepo) planRepo = new BaseRepository<PlanDTO>(PlanSchema, dialect)
  return planRepo
}

export function getSubscriptionRepo(dialect: IDialect): BaseRepository<SubscriptionDTO> {
  if (!subscriptionRepo) subscriptionRepo = new BaseRepository<SubscriptionDTO>(SubscriptionSchema, dialect)
  return subscriptionRepo
}

export function getInvoiceRepo(dialect: IDialect): BaseRepository<InvoiceDTO> {
  if (!invoiceRepo) invoiceRepo = new BaseRepository<InvoiceDTO>(InvoiceSchema, dialect)
  return invoiceRepo
}

export function getUsageLogRepo(dialect: IDialect): BaseRepository<UsageLogDTO> {
  if (!usageLogRepo) usageLogRepo = new BaseRepository<UsageLogDTO>(UsageLogSchema, dialect)
  return usageLogRepo
}

export function resetRepos(): void {
  planRepo = null
  subscriptionRepo = null
  invoiceRepo = null
  usageLogRepo = null
}
