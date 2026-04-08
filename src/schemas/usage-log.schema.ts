// @mostajs/subscriptions-plan — UsageLog Schema
// Author: Dr Hamid MADANI drmdh@msn.com

import type { EntitySchema } from '@mostajs/orm'

export const UsageLogSchema: EntitySchema = {
  name: 'UsageLog',
  collection: 'usage_logs',
  timestamps: true,

  fields: {
    date:      { type: 'string', required: true },    // YYYY-MM-DD
    requests:  { type: 'number', default: 0 },
    reads:     { type: 'number', default: 0 },
    writes:    { type: 'number', default: 0 },
    errors:    { type: 'number', default: 0 },
    bandwidth: { type: 'number', default: 0 },        // bytes
  },

  relations: {
    account: { type: 'many-to-one', target: 'Account', required: true },
    project: { type: 'many-to-one', target: 'Project' },
  },

  indexes: [
    { fields: { date: 'desc' } },
    { fields: { date: 'asc', account: 'asc' } },
  ],
}
