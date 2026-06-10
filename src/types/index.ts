// @mostajs/subscriptions-plan — Types
// Author: Dr Hamid MADANI drmdh@msn.com

// ══════════════════════════════════════════════════════════
// Plan
// ══════════════════════════════════════════════════════════

export interface PlanLimits {
  maxProjects: number        // -1 = illimite
  maxApiKeys: number         // -1 = illimite
  requestsPerDay: number     // -1 = illimite
  maxPoolSize: number
  dialects: string[] | '*'
  transports: string[] | '*'
  replication: boolean
}

export interface PlanDTO {
  id: string
  name: string
  slug: string
  price: number              // centimes (2900 = $29.00)
  currency: string
  interval: 'month' | 'year' | 'one_time'   // 'one_time' = ponctuel (pas de renouvellement)
  stripePriceId?: string
  limits: PlanLimits
  features: string[]
  active: boolean
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

// ══════════════════════════════════════════════════════════
// Subscription
// ══════════════════════════════════════════════════════════

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'

export interface SubscriptionDTO {
  id: string
  accountId: string
  planId: string
  status: SubscriptionStatus
  stripeSubId?: string
  currentPeriodStart?: string
  currentPeriodEnd?: string
  cancelAt?: string
  trialEnd?: string
  /** Scope générique (optionnel) : 'account' (défaut) | 'course' | 'project' | … */
  scopeType?: string
  /** Id de l'entité scopée (ex. courseId) quand scopeType ≠ 'account' */
  scopeId?: string
  createdAt?: string
  updatedAt?: string
}

/** Scope d'un abonnement — entité à laquelle il est rattaché. */
export interface SubscriptionScope {
  type: string   // 'account' | 'course' | 'project' | …
  id: string
}

// ══════════════════════════════════════════════════════════
// Invoice
// ══════════════════════════════════════════════════════════

export type InvoiceStatus = 'open' | 'paid' | 'void' | 'uncollectible'

export interface InvoiceDTO {
  id: string
  accountId: string
  subscriptionId?: string
  stripeInvoiceId?: string
  amount: number             // centimes
  currency: string
  status: InvoiceStatus
  paidAt?: string
  periodStart?: string
  periodEnd?: string
  pdfUrl?: string
  hostedUrl?: string
  createdAt?: string
  updatedAt?: string
}

// ══════════════════════════════════════════════════════════
// Usage
// ══════════════════════════════════════════════════════════

export interface UsageLogDTO {
  id: string
  accountId: string
  projectId?: string
  date: string               // YYYY-MM-DD
  requests: number
  reads: number
  writes: number
  errors: number
  bandwidth: number          // bytes
  createdAt?: string
  updatedAt?: string
}

// ══════════════════════════════════════════════════════════
// Billing config
// ══════════════════════════════════════════════════════════

export interface BillingConfig {
  stripeSecretKey: string
  stripeWebhookSecret: string
  successUrl: string
  cancelUrl: string
  portalReturnUrl: string
}

// ══════════════════════════════════════════════════════════
// Quota check result
// ══════════════════════════════════════════════════════════

export interface QuotaCheckResult {
  allowed: boolean
  reason?: string
  current: number
  limit: number
  resource: string
}
