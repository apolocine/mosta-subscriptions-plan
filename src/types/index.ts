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
  interval: 'month' | 'year'
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
  createdAt?: string
  updatedAt?: string
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
