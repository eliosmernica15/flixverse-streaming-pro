# Stripe billing & webhooks

FlixVerse uses Stripe Checkout for subscriptions. Webhooks sync subscription state to Firestore via the Firebase Admin SDK.

## Webhook endpoint

| Environment | URL |
|-------------|-----|
| Production | `https://your-domain.com/api/billing/webhook` |
| Local (Stripe CLI) | `http://localhost:3000/api/billing/webhook` |

**Method:** `POST` only (Stripe sends signed events)

**Health check:** `GET /api/billing/webhook` returns configuration status (no secrets).

## Required environment variables

```env
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Price IDs (create in Stripe Dashboard → Products)
STRIPE_PRICE_STANDARD_MONTHLY=price_...
STRIPE_PRICE_STANDARD_YEARLY=price_...
STRIPE_PRICE_PREMIUM_MONTHLY=price_...

# Firebase Admin (server-only — webhook cannot use client SDK)
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
# OR
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Copy `.env.example` to `.env.local` and fill in values.

## Stripe Dashboard setup

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks).
2. Click **Add endpoint**.
3. Enter your production URL: `https://your-domain.com/api/billing/webhook`
4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Click **Add endpoint**, then reveal **Signing secret** (`whsec_...`).
6. Set `STRIPE_WEBHOOK_SECRET` in your hosting provider (Vercel, etc.).

Checkout and Customer Portal metadata must include `userId` and `planId` — this is set automatically in `/api/billing/checkout`.

## Local development with Stripe CLI

```bash
# Install: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/billing/webhook
```

The CLI prints a webhook signing secret. Use it as `STRIPE_WEBHOOK_SECRET` in `.env.local`.

Trigger test events:

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
```

## Firestore data model

Document path: `subscriptions/{userId}`

| Field | Type | Description |
|-------|------|-------------|
| `plan` | `"free"` \| `"standard"` \| `"premium"` | Active plan |
| `status` | `"active"` \| `"trialing"` \| `"canceled"` \| `"past_due"` \| … | Stripe status |
| `stripeCustomerId` | string | Stripe customer ID |
| `stripeSubscriptionId` | string | Stripe subscription ID |
| `currentPeriodEnd` | number | Unix ms timestamp |
| `updatedAt` | number | Last sync time |
| `syncedBy` | string | `"stripe-webhook"` or client fallback |

Idempotency records: `stripe_webhook_events/{stripeEventId}` (Admin SDK only, clients denied).

## API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/billing/checkout` | POST | Create Checkout session |
| `/api/billing/session` | GET | Verify return URL `session_id` |
| `/api/billing/portal` | POST | Customer billing portal |
| `/api/billing/webhook` | POST | Stripe event handler |

## Checkout return flow

1. User completes Checkout → redirected to `/plans?success=1&session_id={CHECKOUT_SESSION_ID}`
2. `PlansCheckoutSuccess` calls `/api/billing/session?session_id=...`
3. Session route verifies with Stripe and writes Firestore (Admin SDK)
4. Webhook also writes on `checkout.session.completed` (authoritative for renewals/cancels)

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Webhook returns 503 | Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` |
| Webhook 400 Invalid signature | Wrong `STRIPE_WEBHOOK_SECRET` — use the secret from the exact endpoint (or CLI) |
| Subscription not in Firestore | Configure Firebase Admin credentials; check server logs |
| Plan shows free after payment | Ensure `metadata.userId` on subscription; redeploy after env changes |
| Duplicate events | Handled automatically via `stripe_webhook_events` idempotency |

## Firebase service account

1. Firebase Console → Project Settings → Service accounts
2. **Generate new private key** → download JSON
3. Either paste the full JSON as `FIREBASE_SERVICE_ACCOUNT_JSON` (single line), or extract `client_email` and `private_key` into separate env vars

Deploy Firestore rules after changes: `firebase deploy --only firestore:rules`
