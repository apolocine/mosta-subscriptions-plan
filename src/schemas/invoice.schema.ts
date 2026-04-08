// @mostajs/subscriptions-plan — Invoice Schema
// Author: Dr Hamid MADANI drmdh@msn.com

import type { EntitySchema } from '@mostajs/orm'

export const InvoiceSchema: EntitySchema = {
  name: 'Invoice',
  collection: 'invoices',
  timestamps: true,

  fields: {
    stripeInvoiceId: { type: 'string' },
    amount:          { type: 'number', required: true },    // centimes
    currency:        { type: 'string', default: 'usd' },
    status:          { type: 'string', required: true, default: 'open' },
    paidAt:          { type: 'date' },
    periodStart:     { type: 'date' },
    periodEnd:       { type: 'date' },
    pdfUrl:          { type: 'string' },
    hostedUrl:       { type: 'string' },
  },

  relations: {
    account:      { type: 'many-to-one', target: 'Account', required: true },
    subscription: { type: 'many-to-one', target: 'Subscription' },
  },

  indexes: [
    { fields: { status: 'asc' } },
    { fields: { stripeInvoiceId: 'asc' }, unique: true },
  ],
}
