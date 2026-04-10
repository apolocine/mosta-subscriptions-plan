// @mostajs/subscriptions-plan — Server-side exports (ORM + Stripe dependent)
// Author: Dr Hamid MADANI drmdh@msn.com

// Repositories
export {
  getPlanRepo,
  getSubscriptionRepo,
  getInvoiceRepo,
  getUsageLogRepo,
  resetRepos,
} from './lib/plan-factory.js'

// Quota enforcement
export {
  checkQuota,
  isDialectAllowed,
  isTransportAllowed,
  getUsageSummary,
  incrementUsage,
  DEFAULT_PLANS,
} from './lib/quota-check.js'

// Stripe Billing
export {
  createBillingSession,
  createPortalSession,
  createStripeCustomer,
  cancelSubscription,
  changeSubscriptionPlan,
  verifyWebhookEvent,
  parseBillingEvent,
} from './lib/stripe-billing.js'

// Subscribe (multi-provider via @mostajs/payment)
export { subscribeToPlan } from './lib/subscribe.js'
export type { SubscribeParams, SubscribeResult } from './lib/subscribe.js'

// API handlers
export { createPlanHandlers } from './api/plans.route.js'
export { createSubscriptionHandlers } from './api/subscriptions.route.js'
export { createUsageHandlers } from './api/usage.route.js'

// Module info & schemas
export { getSchemas, moduleInfo } from './lib/module-info.js'

// Registration
export { subscriptionPlanRegistration } from './register.js'
