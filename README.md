# Questra World

Questra World is a professional investment-plan application. Authentication, Amplify hosting, member profiles, and the Step 05 investment data foundation are live. A member can record an investment as awaiting deposit. Deposits, withdrawals, wallets, and commissions are not implemented.

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

These services are the architecture. Cognito, Amplify Hosting, and the member API are defined in CDK. S3 and EventBridge are not part of Step 04.

- AWS Amplify Hosting
- Amazon Cognito
- API Gateway
- AWS Lambda
- Amazon DynamoDB
- Amazon S3
- Amazon EventBridge
- Amazon CloudWatch

## AWS foundation

Step 03 deployed Amazon Cognito and AWS Amplify Hosting in `ap-south-1`. The canonical app is `d1xja8a1py5jgx` at `https://main.d1xja8a1py5jgx.amplifyapp.com`. GitHub is connected with the Amplify GitHub App, not a personal access token. The public pool and app client IDs are the defaults in `lib/auth/config.ts`.

Step 04 adds `QuestworldApi`: an HTTP API, one Lambda, and the on-demand DynamoDB table `questworld-members`. `POST /me/initialize` creates an idempotent profile from the Cognito ID token and an optional pending referral code. `GET /me` and `PATCH /me` read and update the profile. The client cannot set the sponsor. CDK passes the API endpoint to Amplify as `NEXT_PUBLIC_MEMBER_API_URL`. Deploy `QuestworldApi` first, then `QuestworldHosting`. Do not run `cdk deploy --all`.

Step 05 is implemented, deployed, and verified. The same API serves `POST /investments`, `GET /investments`, and `GET /investments/{investmentId}`, all JWT-authorized. Records live in the on-demand table `questworld-investments` (`pk` + `sk`, no GSI) as `USER#<sub>` / `INVESTMENT#<id>` and are created only as `awaiting_deposit`. Production is `https://main.d1xja8a1py5jgx.amplifyapp.com`. The API is `https://tp85xfa9z1.execute-api.ap-south-1.amazonaws.com`.

`.env.example` keeps blank placeholders. Do not commit a production `.env` file. Payment, deposit, wallet, verification, activation, profit, withdrawal, commission, and admin investment operations are not implemented.

Signup is confirmed by a Cognito Pre Sign-up Lambda so members are not asked for an email verification code. Password reset still sends a recovery code.

See [docs/AWS.md](docs/AWS.md) for the resource list, cost behavior, deploy command, teardown command, and the manual GitHub authorization Amplify still needs.

```bash
cd infrastructure
npm ci
npx cdk synth
```

No expensive always-on infrastructure without approval.

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
