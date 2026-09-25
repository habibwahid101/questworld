# Questra World

Questra World is a professional investment-plan application foundation. This repository currently contains the Next.js user interface, design system, and route structure only.

The backend is intentionally not implemented yet.

## Local setup

1. Install Node.js 20 or later.
2. Clone the repository and check out the working branch.
3. Install dependencies:

```bash
npm install
```

4. Copy environment placeholders if needed:

```bash
cp .env.example .env.local
```

5. Start the development server:

```bash
npm run dev
```

The app is available at [http://localhost:3000](http://localhost:3000).

## Development commands

```bash
npm run dev
npm run lint
npm run typecheck
```

## Build command

```bash
npm run build
```

Start the production server after a build:

```bash
npm start
```

## Route summary

### Public
- `/`
- `/plans`
- `/how-it-works`
- `/referrals`
- `/faq`
- `/terms`
- `/privacy`
- `/contact`

### Auth
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`

### Member
- `/dashboard`
- `/investments`
- `/profit-history`
- `/referrals/dashboard`
- `/wallet`
- `/withdraw`
- `/transactions`
- `/profile`

### Admin
- `/admin`
- `/admin/users`
- `/admin/investments`
- `/admin/deposits`
- `/admin/monthly-profit`
- `/admin/referral-commissions`
- `/admin/withdrawals`
- `/admin/transactions`
- `/admin/settings`

## Planned AWS architecture

These services are planned for later approved steps. They are not provisioned in Step 01.

- AWS Amplify Hosting
- Amazon Cognito
- API Gateway
- AWS Lambda
- Amazon DynamoDB
- Amazon S3
- Amazon EventBridge
- Amazon CloudWatch

## AWS cost-efficiency rules

- No EC2
- No always-running server
- No RDS initially
- No NAT Gateway unless later proven necessary
- No ElastiCache
- No OpenSearch
- No WAF initially
- No expensive infrastructure without explicit approval

## Design direction

Premium international fintech visual language: white and off-white surfaces, deep charcoal type, Questra magenta/red accent, restrained spacing, mobile-first layout.

Official brand logo files belong in `public/brand/`. Do not invent a replacement logo.

Current public display values for Step 02:

Investment plans:
- Starter $100
- Growth $1,000
- Professional $10,000
- Premium $100,000

Current Monthly Rate shown in the UI:
- 8% display/demo content only. Future backend will provide the applicable rate.

Referral display rates:
- 3% Direct Sponsor
- 1% Second Generation

No commission calculations, deposits, withdrawals, or profit posting are implemented.

## Project checkpoint

See `docs/PROJECT_CHECKPOINT.md` after each completed step.
