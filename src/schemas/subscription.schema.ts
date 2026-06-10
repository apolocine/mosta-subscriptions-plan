// @mostajs/subscriptions-plan — Subscription Schema
// Author: Dr Hamid MADANI drmdh@msn.com

import type { EntitySchema } from '@mostajs/data-plug'

export const SubscriptionSchema: EntitySchema = {
  name: 'Subscription',
  collection: 'subscriptions',
  timestamps: true,

  fields: {
    status:             { type: 'string', required: true, default: 'active' },
    stripeSubId:        { type: 'string' },
    currentPeriodStart: { type: 'date' },
    currentPeriodEnd:   { type: 'date' },
    cancelAt:           { type: 'date' },
    trialEnd:           { type: 'date' },
    // Scope générique (optionnel, additif/non-breaking) : à quelle ENTITÉ l'abonnement
    // est rattaché. Par défaut 'account' = comportement historique (abo niveau compte).
    // 'course' (race-event), 'project', … → permet PLUSIEURS abos actifs par compte,
    // un par entité scopée. Cf. findActiveSubscription().
    scopeType:          { type: 'string', default: 'account' },
    scopeId:            { type: 'string' },
  },

  relations: {
    account: { type: 'many-to-one', target: 'Account', required: true },
    plan:    { type: 'many-to-one', target: 'Plan', required: true },
  },

  indexes: [
    { fields: { status: 'asc' } },
    { fields: { stripeSubId: 'asc' }, unique: true },
    // Recherche d'abo actif par scope (account|course|…)
    { fields: { scopeType: 'asc', scopeId: 'asc' } },
  ],
}
