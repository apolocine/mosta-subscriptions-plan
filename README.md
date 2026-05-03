# `@mostajs/subscriptions-plan`

**Subscription plans, billing, invoices and usage tracking** pour les hôtes mostajs *(SaaS multi-tenant)*.

**Auteur** : Dr Hamid MADANI <drmdh@msn.com>
**License** : AGPL-3.0-or-later

---

## Principe

`subscriptions-plan` couvre **toute la chaîne facturation** d'un hôte SaaS :

1. **Plans** — catalogue des offres *(Free, Pro, Enterprise, …)* avec limites et features
2. **Subscriptions** — qui souscrit à quoi, quand, état *(active, trialing, past_due, canceled)*
3. **Invoices** — factures émises *(Stripe ou autre provider)*, état de paiement, PDF
4. **Usage** — métriques d'utilisation *(requests/jour, projets, apikeys)* et application des quotas

C'est un module **système** *(au sens : ses 4 tables vivent dans la base système, pas dans la base métier des projets)*. Tirer ces données via `@mostajs/data-plug.getSystemDialect()` pour qu'elles survivent aux mutations de dialect métier *(`/api/change-dialect`, etc.)*.

---

## Install

```bash
npm install @mostajs/subscriptions-plan
# peer deps :
npm install @mostajs/data-plug @mostajs/payment stripe
```

Tous les peer deps sauf `@mostajs/data-plug` sont **optionnels** :
- `@mostajs/payment` : nécessaire pour `subscribeToPlan` *(multi-provider — Stripe, PayPal, Chargily, Satim)*
- `stripe` : nécessaire pour `createBillingSession`, webhooks Stripe directs

---

## Usage

### 1. Enregistrer les schemas système au bootstrap

```ts
import { registerSchemas } from '@mostajs/data-plug'
import {
  PlanSchema, SubscriptionSchema, InvoiceSchema, UsageLogSchema,
} from '@mostajs/subscriptions-plan'

registerSchemas([PlanSchema, SubscriptionSchema, InvoiceSchema, UsageLogSchema])
```

### 2. Seed les plans initiaux *(Free / Pro / …)*

```ts
import { getPlanRepo, DEFAULT_PLANS } from '@mostajs/subscriptions-plan/server'
import { getSystemDialect } from '@mostajs/data-plug'

const dialect = await getSystemDialect()
const planRepo = getPlanRepo(dialect)

for (const plan of DEFAULT_PLANS) {
  await planRepo.upsert({ slug: plan.slug }, plan)
}
```

### 3. Souscrire un account à un plan *(multi-provider via @mostajs/payment)*

```ts
import { subscribeToPlan } from '@mostajs/subscriptions-plan/server'

const result = await subscribeToPlan(dialect, {
  accountId: 'acc_42',
  planSlug: 'pro',
  provider: 'stripe',          // 'stripe' | 'paypal' | 'chargily' | 'satim'
  successUrl: 'https://app/onboarding/success',
  cancelUrl:  'https://app/onboarding/cancel',
})

if (result.ok) {
  // Rediriger l'utilisateur vers result.checkoutUrl
  return Response.redirect(result.checkoutUrl)
}
```

### 4. Vérifier les quotas avant une opération

```ts
import { checkQuota, isDialectAllowed, isTransportAllowed } from '@mostajs/subscriptions-plan/server'

const check = await checkQuota(dialect, accountId, 'maxProjects')
if (!check.allowed) {
  return Response.json({
    error: 'Quota exceeded',
    plan: check.plan,
    limit: check.limit,
    used: check.used,
  }, { status: 402 })   // 402 Payment Required
}

// Vérifier qu'un dialect est autorisé par le plan
const plan = check.plan
if (!isDialectAllowed(plan.limits, 'postgres')) {
  return Response.json({ error: 'Dialect not allowed in your plan' }, { status: 402 })
}
```

### 5. Compter une utilisation *(metering)*

```ts
import { incrementUsage } from '@mostajs/subscriptions-plan/server'

await incrementUsage(dialect, accountId, 'requests', 1)
// → ajoute 1 à UsageLog du jour courant
```

### 6. Webhook Stripe *(provider-direct)*

```ts
import { verifyWebhookEvent, parseBillingEvent } from '@mostajs/subscriptions-plan/server'

app.post('/api/billing/webhook', async (req) => {
  const sig = req.headers['stripe-signature']
  const event = await verifyWebhookEvent(req.rawBody, sig)
  if (!event) return { ok: false }

  const parsed = parseBillingEvent(event)
  // parsed = { type: 'subscription.created' | 'invoice.paid' | …, data: {...} }

  // Update DB en fonction du type
  switch (parsed.type) {
    case 'subscription.created': /* ... */ break
    case 'invoice.paid':         /* ... */ break
    case 'subscription.canceled':/* ... */ break
  }

  return { ok: true }
})
```

### 7. Routes Fastify *(handlers prêts à l'emploi)*

```ts
import {
  createPlanHandlers,
  createSubscriptionHandlers,
  createUsageHandlers,
} from '@mostajs/subscriptions-plan/server'

const planH = createPlanHandlers(dialect, checkPermission)
const subH  = createSubscriptionHandlers(dialect)
const useH  = createUsageHandlers(dialect)

app.get('/api/plans',                 planH.list)
app.post('/api/plans',                planH.create)
app.put('/api/plans/:id',             planH.update)
app.delete('/api/plans/:id',          planH.delete)

app.get('/api/subscriptions/:accountId', subH.byAccount)
app.post('/api/subscriptions/cancel',    subH.cancel)

app.get('/api/usage/:accountId/summary', useH.summary)
```

### 8. Annuler une souscription

```ts
import { cancelCurrentSubscription } from '@mostajs/subscriptions-plan/server'

await cancelCurrentSubscription(dialect, accountId, {
  immediate: false,    // false = annuler à la fin de la période courante
})
```

---

## API

### Server-side *(`@mostajs/subscriptions-plan/server`)*

| Fonction | Rôle |
|----------|------|
| `getPlanRepo` / `getSubscriptionRepo` / `getInvoiceRepo` / `getUsageLogRepo` | Repos *(WeakMap-cached par dialect)* |
| `resetRepos` | No-op rétro-compat *(WeakMap auto-libère)* |
| `subscribeToPlan` | Souscription multi-provider via `@mostajs/payment` |
| `cancelCurrentSubscription` | Annuler la souscription active d'un account |
| `checkQuota` | Vérifie si une opération est dans les limites du plan |
| `isDialectAllowed` / `isTransportAllowed` | Vérifie un dialect/transport contre les limites du plan |
| `getUsageSummary` | Résumé usage pour la période courante |
| `incrementUsage` | Métrique compteur *(requests, …)* |
| `createBillingSession` / `createPortalSession` | Stripe Checkout / Customer Portal |
| `createStripeCustomer` | Crée un customer Stripe |
| `cancelSubscription` / `changeSubscriptionPlan` | Stripe direct |
| `verifyWebhookEvent` / `parseBillingEvent` | Parse webhooks Stripe |
| `createPlanHandlers` / `createSubscriptionHandlers` / `createUsageHandlers` | Handlers Fastify CRUD |
| `DEFAULT_PLANS` | Catalogue par défaut *(Free, Pro, Enterprise, …)* |

### Client-safe *(`@mostajs/subscriptions-plan`)*

```ts
export type {
  PlanDTO, PlanLimits,
  SubscriptionDTO, SubscriptionStatus,
  InvoiceDTO, InvoiceStatus,
  UsageLogDTO, BillingConfig, QuotaCheckResult,
}
export {
  PlanSchema, SubscriptionSchema, InvoiceSchema, UsageLogSchema,
  moduleInfo,
}
```

---

## Schemas

### `PlanDTO`

```ts
{
  id, name, slug,
  price: number,         // centimes (2900 = $29.00)
  currency: string,
  interval: 'month' | 'year',
  stripePriceId?: string,
  limits: PlanLimits,
  features: string[],
  active: boolean,
  sortOrder: number,
}
```

### `PlanLimits`

```ts
{
  maxProjects: number,         // -1 = illimité
  maxApiKeys: number,
  requestsPerDay: number,
  maxPoolSize: number,
  dialects: string[] | '*',
  transports: string[] | '*',
  replication: boolean,
}
```

### `SubscriptionDTO`

```ts
{
  id, accountId, planId,
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid',
  stripeSubId?,
  currentPeriodStart?, currentPeriodEnd?,
  cancelAt?, trialEnd?,
}
```

### `InvoiceDTO`

```ts
{
  id, accountId, subscriptionId?,
  stripeInvoiceId?,
  amount: number,                                       // centimes
  currency: string,
  status: 'open' | 'paid' | 'void' | 'uncollectible',
  paidAt?, periodStart?, periodEnd?,
  pdfUrl?, hostedUrl?,
}
```

### `UsageLogDTO`

Métriques journalières par account *(requests, projets actifs, …)*. Détail dans `src/types/index.ts`.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  @mostajs/subscriptions-plan                                  │
│  (système — vit dans MOSTA_SYSTEM_URI ou singleton métier)    │
│                                                                │
│   PlanSchema                                                   │
│   SubscriptionSchema     ← getSystemDialect()                  │
│   InvoiceSchema                                                │
│   UsageLogSchema                                               │
└──────┬─────────────┬──────────────┬───────────────────────────┘
       │             │              │
       │             │              │ checkQuota / incrementUsage
       │             │              ▼
       │             │     ┌────────────────────────┐
       │             │     │  Hôte (mosta-net)       │
       │             │     │  Routes API,            │
       │             │     │  apikey-middleware      │
       │             │     └────────────────────────┘
       │             │
       │  subscribeToPlan
       ▼             ▼
┌────────────┐  ┌───────────────────┐
│  @mostajs/ │  │  Stripe / PayPal /│
│  payment   │  │  Chargily / Satim │
└────────────┘  └───────────────────┘
```

---

## Changelog

### v0.3.5 — 2026-05-04 — Découplage `@mostajs/orm` via façade `data-plug` + WeakMap × 4 + README initial

Étape 3 du chantier *« system dialect séparé »* — applique trois fix qui se combinent, et livre un README complet *(le module n'en avait pas)*.

#### 1. Migration `@mostajs/orm` → `@mostajs/data-plug` *(façade)*

Conformément au principe *« les modules @mostajs passent par data-plug, jamais hardcoder un dialect ou importer @mostajs/orm directement »*, `subscriptions-plan` ne dépend plus de `@mostajs/orm` en peerDep. Tous les imports de production passent désormais par `@mostajs/data-plug v1.2.4` *(qui ré-exporte `BaseRepository`, `IDialect`, `EntitySchema`, …)*.

**11 fichiers source migrés** *(13 imports orm → 0)* :

```
- src/api/plans.route.ts             (IDialect)
- src/api/subscriptions.route.ts     (IDialect)
- src/api/usage.route.ts             (IDialect)
- src/lib/plan-factory.ts            (BaseRepository + IDialect)
- src/lib/subscribe.ts               (IDialect — statique + dynamic L152)
- src/lib/quota-check.ts             (IDialect)
- src/lib/module-info.ts             (EntitySchema)
- src/schemas/plan.schema.ts         (EntitySchema)
- src/schemas/subscription.schema.ts (EntitySchema)
- src/schemas/invoice.schema.ts      (EntitySchema)
- src/schemas/usage-log.schema.ts    (EntitySchema)
- package.json                       (peerDep orm → peerDep data-plug)
```

#### 2. WeakMap × 4 dans `plan-factory.ts`

4 caches module-level remplacés par 4 WeakMaps indépendantes :

```ts
// Avant
let planRepo:         BaseRepository<PlanDTO>         | null = null
let subscriptionRepo: BaseRepository<SubscriptionDTO> | null = null
let invoiceRepo:      BaseRepository<InvoiceDTO>      | null = null
let usageLogRepo:     BaseRepository<UsageLogDTO>     | null = null
  ↓
const planCache         = new WeakMap<IDialect, BaseRepository<PlanDTO>>()
const subscriptionCache = new WeakMap<IDialect, BaseRepository<SubscriptionDTO>>()
const invoiceCache      = new WeakMap<IDialect, BaseRepository<InvoiceDTO>>()
const usageLogCache     = new WeakMap<IDialect, BaseRepository<UsageLogDTO>>()
```

Évite que les repos capturent la référence du PREMIER dialect passé et ignorent tous les suivants. Lorsque `/api/change-dialect` *(ou rotation système↔métier)* modifie le dialect courant, les 4 caches missent et reconstruisent les repos avec la **nouvelle** instance dialect.

`resetRepos()` conservé en no-op pour rétro-compat *(les WeakMaps auto-libèrent naturellement les entrées dont le dialect n'est plus référencé)*.

#### 3. Correction anomalie pré-existante `file:..` en devDeps

Les deux entrées violaient la règle d'écosystème *« entre modules @mostajs : toujours bump+publish+semver, jamais `file:..` »* :

```
"@mostajs/orm":     "file:../mosta-orm"     → "^1.13.1"
"@mostajs/payment": "file:../mosta-payment" → "^0.4.1"
```

#### 4. README initial *(386 lignes)*

Le module n'avait pas de README. Création d'une doc complète :

- **Principe** *(subscription plans, billing, quota, place dans l'écosystème système)*
- **Install** *(peer deps + optionnels)*
- **Usage** — 8 sections how-to :
    1. Register schemas au bootstrap
    2. Seed plans initiaux *(`DEFAULT_PLANS`)*
    3. `subscribeToPlan` multi-provider
    4. `checkQuota` / `isDialectAllowed` / `isTransportAllowed`
    5. `incrementUsage` *(metering)*
    6. Webhook Stripe *(`verifyWebhookEvent` / `parseBillingEvent`)*
    7. Routes Fastify *(`createPlanHandlers` / `createSubscriptionHandlers` / `createUsageHandlers`)*
    8. `cancelCurrentSubscription`
- **API reference** *(server-side + client-safe)*
- **Schemas** : `PlanDTO`, `PlanLimits`, `SubscriptionDTO`, `InvoiceDTO`, `UsageLogDTO`
- **Architecture** *(diagramme : système ↔ payment ↔ providers)*
- **Changelog v0.3.5** détaillé
- **License** *(AGPL-3.0-or-later + commercial)*

#### Bump

`0.3.4 → 0.3.5` *(patch — découplage interne, signatures publiques inchangées)*.

---

### v0.3.4 et antérieurs

Versions initiales de plans + Stripe billing + quota enforcement. Pas de release notes archivées.

---

## License

[AGPL-3.0-or-later](LICENSE) — usage libre tant que le code dérivé reste open-source.
**Licence commerciale** disponible : `drmdh@msn.com`. Pricing par projet, pas par seat.

— (c) 2026 Dr Hamid MADANI \<drmdh@msn.com\>
