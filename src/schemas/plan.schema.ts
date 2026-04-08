// @mostajs/subscriptions-plan — Plan Schema
// Author: Dr Hamid MADANI drmdh@msn.com

import type { EntitySchema } from '@mostajs/orm'

export const PlanSchema: EntitySchema = {
  name: 'Plan',
  collection: 'plans',
  timestamps: true,

  fields: {
    name:          { type: 'string', required: true },
    slug:          { type: 'string', required: true },
    price:         { type: 'number', required: true },     // centimes (2900 = $29)
    currency:      { type: 'string', default: 'usd' },
    interval:      { type: 'string', default: 'month' },   // month | year
    stripePriceId: { type: 'string' },
    limits:        { type: 'json', required: true },
    features:      { type: 'json' },
    active:        { type: 'boolean', default: true },
    sortOrder:     { type: 'number', default: 0 },
  },

  relations: {},

  indexes: [
    { fields: { slug: 'asc' }, unique: true },
    { fields: { active: 'asc', sortOrder: 'asc' } },
  ],
}
