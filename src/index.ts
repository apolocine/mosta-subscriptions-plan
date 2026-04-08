// @mostajs/subscriptions-plan — Client-safe exports
// Subscription plans, billing, invoices and usage tracking
// Author: Dr Hamid MADANI drmdh@msn.com

// Types
export type {
  PlanDTO,
  PlanLimits,
  SubscriptionDTO,
  SubscriptionStatus,
  InvoiceDTO,
  InvoiceStatus,
  UsageLogDTO,
  BillingConfig,
  QuotaCheckResult,
} from './types/index.js'

// Schemas
export { PlanSchema } from './schemas/plan.schema.js'
export { SubscriptionSchema } from './schemas/subscription.schema.js'
export { InvoiceSchema } from './schemas/invoice.schema.js'
export { UsageLogSchema } from './schemas/usage-log.schema.js'

// Module info
export { moduleInfo } from './lib/module-info.js'
