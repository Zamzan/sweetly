# Sweetly

Multi-tenant SaaS platform for local sweet shops, bakeries, cake shops and
gift shops to get an online storefront with WhatsApp-based ordering —
without building their own website.

One Next.js codebase. One Vercel deployment. Every shop is resolved
dynamically from its URL slug (`/rahman-sweets`, `/mithai-magic`, …).

## Stack

- **Frontend/Backend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Database:** Supabase PostgreSQL, with Row Level Security on every table
- **Auth:** Supabase Auth (no custom password system)
- **Storage:** Supabase Storage (shop-scoped folders, enforced by storage RLS)
- **Rate limiting:** Upstash Redis
- **Deployment:** Vercel

## Project structure

```
supabase/migrations/       Schema, RLS policies, storage policies, demo seed
src/middleware.ts          Session refresh, route guards, security headers
src/lib/                   Supabase clients, validation, WhatsApp, rate limiting
src/app/(auth)/            Signup, login, forgot/reset password
src/app/dashboard/         Shop-owner dashboard (products, orders, settings, ...)
src/app/admin/             Platform admin panel
src/app/[shopSlug]/        Public storefront (dynamic per shop)
src/app/api/               Route handlers for public writes (orders, uploads)
tests/                     Tenant isolation tests (direct API calls)
```

## Local setup

1. **Create a Supabase project.** In the SQL editor, run the migrations in
   `supabase/migrations/` **in order**: `0001_schema.sql` → `0002_rls.sql` →
   → `0003_storage.sql`. Skip `0004_seed.sql` unless you want demo data (see
   below).

2. **Copy environment variables:**
   ```
   cp .env.example .env.local
   ```
   Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   from Supabase → Project Settings → API. Fill in `SUPABASE_SERVICE_ROLE_KEY`
   from the same page — **treat it like a root password**, never commit it,
   never send it to the browser.

3. **(Optional) Set up Upstash Redis** for rate limiting — create a free
   database at upstash.com and copy the REST URL/token into `.env.local`. If
   you skip this, the app still runs, but every rate-limited route logs a
   loud warning and allows unlimited requests. Do not skip this in production.

4. **Install and run:**
   ```
   npm install
   npm run dev
   ```

5. **(Optional) Seed a demo shop:** create a real auth user first (Supabase
   Dashboard → Authentication → Add user, or sign up through the app), copy
   their UUID into `supabase/migrations/0004_seed.sql`, then run that file in
   the SQL editor. This creates "Rahman Sweets" with sample products. Do not
   run this against a production database with real users.

## Deploying to Vercel

1. Push this repo to GitHub. `.gitignore` already excludes `.env*` — double
   check `git status` shows no env files before your first commit.
2. In Vercel: **New Project → Import from GitHub**.
3. Add the same environment variables from `.env.local` under
   **Project Settings → Environment Variables** (all of them — including the
   service role key, which Vercel keeps server-side only; it is never
   bundled into client JavaScript because it's read only in files marked
   `import "server-only"`).
4. Set `NEXT_PUBLIC_SITE_URL` to your actual deployment URL, e.g.
   `https://sweetly.vercel.app` (used for password-reset redirect links and
   Open Graph metadata — do not hardcode a domain in source).
5. Deploy. No custom domain is required for the MVP.

### Supabase Auth redirect URLs

In Supabase → Authentication → URL Configuration, add your Vercel URL (and
`http://localhost:3000` for local dev) to **Redirect URLs**, so
`resetPasswordForEmail` links work.

## Seeing which shops have registered

`/admin` and `/admin/shops` list every shop on the platform (name, slug,
location, publish status, plan, registration date) — but only for users
flagged `PLATFORM_ADMIN`. To make your own account an admin, run
`supabase/ops/promote_to_admin.sql` once in the Supabase SQL editor with your
own auth user UUID (find it under Authentication → Users). This is a
one-time manual step by design — there's no self-serve "become admin" button
anywhere in the app, since that's exactly the kind of privilege escalation
the security review in this spec is meant to prevent.

## Setting up real subscription payments (Razorpay)

The MVP shipped subscription status as read-only, since faking a "payment
successful" state was explicitly disallowed. This is now wired up for real:

1. **Create a Razorpay account** (business KYC required to accept live
   payments; test mode works immediately for development).
2. **Get API keys:** Razorpay Dashboard → Settings → API Keys. Copy the
   Key ID into `NEXT_PUBLIC_RAZORPAY_KEY_ID` and the Key Secret into
   `RAZORPAY_KEY_SECRET` (server-only — never expose the secret).
3. **Set up the webhook** (this is the authoritative source of truth, not
   the browser): Razorpay Dashboard → Settings → Webhooks → Add New
   Webhook.
   - URL: `https://<your-domain>/api/webhooks/razorpay`
   - Active events: at minimum `payment.captured`, `payment.failed`,
     `refund.processed`
   - Copy the webhook secret it generates into `RAZORPAY_WEBHOOK_SECRET`.
4. **Deploy** with all three env vars set in Vercel.
5. **Test it:** in Razorpay test mode, go to `/dashboard/subscription` as a
   shop owner, click a plan, and pay with Razorpay's test card
   (`4111 1111 1111 1111`, any future expiry, any CVV). The dashboard
   updates via the client-verify call; the webhook independently confirms
   it moments later even if you close the tab before that happens.

**How the security holds up:**
- The amount charged is looked up server-side from `src/lib/razorpay.ts`
  `PLANS` by plan id — the browser never sends an amount, so it can't be
  tampered with to pay less.
- `shop_id` is taken from the authenticated owner's session when creating
  the order, and from the order's own `notes` (which *we* set, not the
  payer) when the webhook processes the result — never from anything a
  customer-facing form could inject.
- Both the client-side verification (`/api/subscriptions/verify`) and the
  webhook (`/api/webhooks/razorpay`) independently check an HMAC-SHA256
  signature using `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` before
  trusting anything in the payload — a forged "payment succeeded" request
  without those secrets is cryptographically rejected.
- There is still no RLS policy allowing a client to write to
  `subscriptions` directly (see `0002_rls.sql`) — every activation goes
  through the service-role client, and only after signature verification.

## Security checklist (read before going live)

- [x] RLS enabled on every exposed table (`supabase/migrations/0002_rls.sql`)
- [x] Storage buckets scoped by shop-id folder + storage RLS
      (`0003_storage.sql`)
- [x] No `shop_id`/`owner_id` ever trusted from the client — every write
      resolves the current shop from the session (`src/lib/current-shop.ts`)
      or, for anonymous customer writes, from the shop **slug** looked up
      server-side (`src/app/api/**/route.ts`)
- [x] Passwords handled entirely by Supabase Auth — never touched in app code
- [x] Zod validation on every write path (`src/lib/validation.ts`)
- [x] Uploaded images validated by size, declared MIME type, **and**
      magic-byte sniffing (rejects renamed non-image files)
- [x] WhatsApp destination number always read from the shop's own DB row,
      never from a request parameter (`src/lib/whatsapp.ts`)
- [x] Rate limiting on login, signup, password reset, public order/custom-order
      submission, and image uploads (`src/lib/rate-limit.ts`) — **requires**
      Upstash env vars to actually take effect
- [x] Security headers (CSP, HSTS, X-Frame-Options, etc.) set in middleware
- [x] Generic error messages to the client; details only logged server-side
- [x] Admin routes verify `platform_role` server-side in both middleware
      and the admin layout (defense in depth, not just hidden nav)
- [x] Subscription status is read-only from the client; only a future
      payment-provider webhook (server-side, signature-verified) may change it
- [x] `.env.example` provided; `.gitignore` excludes all real env files
- [ ] **You must configure Upstash before production** or rate limiting is a
      no-op
- [ ] **You must replace the placeholder Terms/Privacy pages** with
      counsel-reviewed text before accepting real customers
- [x] Payment integration: Razorpay Checkout + server-side signature
      verification + authoritative webhook (`/api/webhooks/razorpay`).
      Requires your own Razorpay account/keys — see "Setting up real
      subscription payments" above. Test in Razorpay test mode before
      going live with real cards.
- [ ] Run `tests/tenant-isolation.test.ts` against a **test** Supabase
      project with two real shop-owner accounts before launch (see the
      header comment in that file for the required env vars)

## What's intentionally NOT built yet (by spec)

These are architected for (extensible schema/routing) but not implemented,
per the instruction not to build unnecessary features into the MVP:

- Custom/subdomain support (the slug-based resolver in
  `src/lib/public-shop.ts` is the single place you'd extend to also resolve
  by subdomain or custom domain)
- Online customer checkout payments (WhatsApp + owner-handled payment is the
  MVP flow)
- Official WhatsApp Business Platform (API) integration — current flow is
  user-initiated Click-to-Chat only, as required
- AI features, analytics, multi-location, coupons, reviews, loyalty

## Known limitations to flag to stakeholders

- The product/category image galleries in the dashboard render a placeholder
  block in a few list views (`_components/product-row.tsx` etc.) rather than
  the uploaded photo — wiring the `product_images` table into those list
  queries is a small follow-up, not a security gap.
- Staff management (`/dashboard/staff`) adds an *existing* Sweetly user as
  staff by email with per-permission checkboxes (products/orders); it does
  not send an email invite or create new accounts on someone's behalf — the
  person must already have signed up.
