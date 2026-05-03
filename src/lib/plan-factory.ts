// @mostajs/subscriptions-plan — Repository factories
// Author: Dr Hamid MADANI drmdh@msn.com
//
// Cache keyed par identité du dialect (WeakMap) — un changement de dialect
// (ex: /api/change-dialect côté serveur, ou rotation système↔métier) produit
// un cache miss et une reconstruction. Évite le bug où le repo capturait
// la référence du PREMIER dialect passé et ignorait tous les suivants — ce
// qui conduisait à "PostgreSQL not connected. Call connect() first." après
// disconnect d'une connexion qui restait quand même cached dans le repo.
//
// 4 entités du module (Plan, Subscription, Invoice, UsageLog) → 4 WeakMaps
// indépendantes. Une mutation dialect invalide les 4 caches simultanément
// (au prochain appel) sans coordination explicite.

import { BaseRepository } from '@mostajs/data-plug'
import type { IDialect } from '@mostajs/data-plug'
import { PlanSchema } from '../schemas/plan.schema.js'
import { SubscriptionSchema } from '../schemas/subscription.schema.js'
import { InvoiceSchema } from '../schemas/invoice.schema.js'
import { UsageLogSchema } from '../schemas/usage-log.schema.js'
import type { PlanDTO, SubscriptionDTO, InvoiceDTO, UsageLogDTO } from '../types/index.js'

const planCache = new WeakMap<IDialect, BaseRepository<PlanDTO>>()
const subscriptionCache = new WeakMap<IDialect, BaseRepository<SubscriptionDTO>>()
const invoiceCache = new WeakMap<IDialect, BaseRepository<InvoiceDTO>>()
const usageLogCache = new WeakMap<IDialect, BaseRepository<UsageLogDTO>>()

export function getPlanRepo(dialect: IDialect): BaseRepository<PlanDTO> {
  let r = planCache.get(dialect)
  if (!r) {
    r = new BaseRepository<PlanDTO>(PlanSchema, dialect)
    planCache.set(dialect, r)
  }
  return r
}

export function getSubscriptionRepo(dialect: IDialect): BaseRepository<SubscriptionDTO> {
  let r = subscriptionCache.get(dialect)
  if (!r) {
    r = new BaseRepository<SubscriptionDTO>(SubscriptionSchema, dialect)
    subscriptionCache.set(dialect, r)
  }
  return r
}

export function getInvoiceRepo(dialect: IDialect): BaseRepository<InvoiceDTO> {
  let r = invoiceCache.get(dialect)
  if (!r) {
    r = new BaseRepository<InvoiceDTO>(InvoiceSchema, dialect)
    invoiceCache.set(dialect, r)
  }
  return r
}

export function getUsageLogRepo(dialect: IDialect): BaseRepository<UsageLogDTO> {
  let r = usageLogCache.get(dialect)
  if (!r) {
    r = new BaseRepository<UsageLogDTO>(UsageLogSchema, dialect)
    usageLogCache.set(dialect, r)
  }
  return r
}

/**
 * No-op préservé pour rétro-compat — les WeakMaps libèrent naturellement
 * les entrées dont le dialect n'est plus référencé.
 */
export function resetRepos(): void {
  // Auto-cleanup via WeakMap : intentional no-op.
}
