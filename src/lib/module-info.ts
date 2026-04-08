// @mostajs/subscriptions-plan — Module info
// Author: Dr Hamid MADANI drmdh@msn.com

import type { EntitySchema } from '@mostajs/orm'
import { PlanSchema } from '../schemas/plan.schema.js'
import { SubscriptionSchema } from '../schemas/subscription.schema.js'
import { InvoiceSchema } from '../schemas/invoice.schema.js'
import { UsageLogSchema } from '../schemas/usage-log.schema.js'

export function getSchemas(): EntitySchema[] {
  return [PlanSchema, SubscriptionSchema, InvoiceSchema, UsageLogSchema]
}

export const moduleInfo = {
  name: 'subscriptions-plan',
  label: 'Subscriptions & Plans',
  description: 'Subscription plans, billing, invoices and usage tracking',
  version: '0.1.0',
  schemas: ['Plan', 'Subscription', 'Invoice', 'UsageLog'],
}
