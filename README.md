# PMP Mock Test Platform

A production-ready PMI mock exam platform. Users pay **$0.49 per test** via Stripe, get 20 AI-generated PMP questions via Claude, take a timed test, and receive a scored results report with domain breakdown and answer review.

---

## Architecture

```
User → Landing Page → Stripe Checkout ($0.49) → Webhook → Supabase
                                                          ↓
                         Test Page ← session_id redirect ↓
                              ↓
                    Claude API (20 questions generated)
                              ↓
                    Submit → Score → Results Page
```

**Stack:** Next.js 14 (App Router) · Supabase · Stripe · Anthropic Claude API · Vercel

---

## Step-by-Step Setup

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd pmi-mock-test
npm install
```

### 2. Supabase Setup

1. Go to [supabase.com](https://supabase.com) → New Project
2. Open **SQL Editor** → paste contents of `supabase-schema.sql` → Run
3. Go to **Project Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Stripe Setup

1. Go to [stripe.com](https://stripe.com) → Dashboard
2. **API Keys** → copy:
   - Secret key → `STRIPE_SECRET_KEY`
   - Publishable key → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. For **local testing**, install Stripe CLI:
   ```bash
   brew install stripe/stripe-cli/stripe
   stripe login
   stripe listen --forward-to localhost:3000/api/webhook
   # Copy the webhook signing secret → STRIPE_WEBHOOK_SECRET
   ```
4. For **production**, go to Stripe Dashboard → Webhooks → Add endpoint:
   - URL: `https://yourdomain.com/api/webhook`
   - Events: `checkout.session.completed`
   - Copy signing secret → `STRIPE_WEBHOOK_SECRET`

### 4. Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. API Keys → Create key → `ANTHROPIC_API_KEY`

### 5. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in all values:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

ANTHROPIC_API_KEY=sk-ant-...

NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 6. Run Locally

```bash
# Terminal 1 — Next.js dev server
npm run dev

# Terminal 2 — Stripe webhook listener
stripe listen --forward-to localhost:3000/api/webhook
```

Visit `http://localhost:3000`

**Test card:** `4242 4242 4242 4242` · Any expiry · Any CVC

---

## Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set all environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add STRIPE_SECRET_KEY
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
vercel env add STRIPE_WEBHOOK_SECRET
vercel env add ANTHROPIC_API_KEY
vercel env add NEXT_PUBLIC_BASE_URL   # set to https://yourdomain.com

# Re-deploy with env vars
vercel --prod
```

After deploy:
1. Update `NEXT_PUBLIC_BASE_URL` to your production URL
2. Update Stripe webhook endpoint to `https://yourdomain.com/api/webhook`
3. Update Stripe Success URL in `app/api/create-checkout/route.ts` (already uses env var)

---

## Money Flow

```
$0.49 collected by Stripe
  → Stripe takes ~$0.20 in fees (card processing + fixed fee)
  → You net ~$0.29 per test
  → At 100 tests/day = ~$29/day → ~$870/month net
  → At 1000 tests/day = ~$290/day → ~$8,700/month net
```

**Cost to run:**
- Vercel: Free tier handles ~10K req/month, then $20/mo Pro
- Supabase: Free tier works up to 50K rows / 500MB
- Claude API: ~$0.01–0.03 per question set (claude-opus-4-5)
- Anthropic cost per test: ~$0.02
- **Net margin per test: ~$0.27**

---

## File Structure

```
pmi-mock-test/
├── app/
│   ├── page.tsx                    # Landing page with email + pay button
│   ├── page.module.css
│   ├── layout.tsx                  # Root layout + metadata
│   ├── globals.css                 # Global styles + CSS variables
│   ├── test/
│   │   ├── page.tsx                # Protected test page
│   │   └── test.module.css
│   ├── results/
│   │   └── [sessionId]/
│   │       ├── page.tsx            # Results + review page
│   │       └── results.module.css
│   └── api/
│       ├── create-checkout/route.ts   # POST → Stripe Checkout Session
│       ├── webhook/route.ts           # POST → Stripe webhook handler
│       ├── session/route.ts           # GET → verify session status
│       ├── generate-questions/route.ts # POST → Claude question gen
│       ├── submit-test/route.ts       # POST → score + save results
│       └── results/[sessionId]/route.ts # GET → fetch results
├── lib/
│   ├── supabase.ts                 # Supabase clients (anon + admin)
│   └── stripe.ts                   # Stripe client + constants
├── types/
│   └── index.ts                    # Shared TypeScript types
├── supabase-schema.sql             # Run this in Supabase SQL editor
├── vercel.json                     # Vercel deployment config
├── .env.local.example              # Environment variable template
└── package.json
```

---

## Customization

**Change price:** Edit `TEST_PRICE_CENTS` in `lib/stripe.ts`

**Change number of questions:** Update `total_questions` default in schema + `generate-questions/route.ts` prompt

**Change timer:** Edit `setTimeLeft(3600)` in `app/test/page.tsx`

**Change pass threshold:** Edit `score >= 61` in `api/submit-test/route.ts`

**Add more question domains:** Edit the `PROMPT` constant in `api/generate-questions/route.ts`

---

## Monitoring

Check your Supabase dashboard → Table Editor → `test_sessions` for:
- All paid sessions
- Completion rates
- Average scores
- Revenue tracking (one row = $0.49 charged)

Run the analytics view:
```sql
select * from test_analytics;
```
