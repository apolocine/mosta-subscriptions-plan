# Changelog — `@mostajs/subscriptions-plan`

**Auteur** : Dr Hamid MADANI <drmdh@msn.com>

## 0.4.0 — 2026-06-10

### Ajouté (additif, **non-breaking**)
- **Scope générique sur `Subscription`** : champs optionnels `scopeType` (défaut `'account'`) et
  `scopeId`. Permet de rattacher un abonnement à une **entité** autre que le compte
  (`'course'` pour race-event, `'project'`, …) → un compte peut avoir **plusieurs abonnements
  actifs**, un par entité scopée. L'annulation des abos existants ne touche que le **même scope**.
- **`subscribeToPlan(dialect, { …, scope?: { type, id } })`** : propage le scope (chemin direct
  et `metadata` du provider de paiement).
- **`findActiveSubscription(dialect, { accountId?, scope? })`** : trouve l'abo actif d'un compte
  ou d'une entité scopée (exporté depuis `./server`).
- **Routes `/subscription`** : `GET` accepte `?scopeType=&scopeId=` (ou `accountId`) ; `POST`
  persiste `scopeType/scopeId` et annule les abos actifs du même scope.
- **`Plan.interval`** accepte désormais `'one_time'` (en plus de `'month' | 'year'`) — corrige
  l'incohérence des plans ponctuels (sponsoring par édition) ; le défaut reste récurrent.

### Migration
Aucune action requise : les champs sont optionnels (auto-ALTER ORM). Les abonnements existants
(compte-scopés) restent valides ; en l'absence de scope, le comportement est identique à 0.3.x.

## 0.3.6
- Souscription multi-provider (`subscribeToPlan`), facturation Stripe, factures, quotas/usage.
