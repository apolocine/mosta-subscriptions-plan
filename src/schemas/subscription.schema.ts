// @mostajs/subscriptions-plan — Subscription Schema
// Author: Dr Hamid MADANI drmdh@msn.com

import type { EntitySchema } from '@mostajs/orm'

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
  },

  relations: {
    account: { type: 'many-to-one', target: 'Account', required: true },
    plan:    { type: 'many-to-one', target: 'Plan', required: true },
  },

  indexes: [
    { fields: { status: 'asc' } },
    { fields: { stripeSubId: 'asc' }, unique: true },
  ],
}
