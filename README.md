# Questra World

Questra World is a professional investment-plan application. Authentication, Amplify hosting, member profiles, and investment records are live. A member can submit a deposit reference, an admin can verify and activate it, and the monthly job can post profit and referral commissions. A member can request a withdrawal of posted profit. Nothing is paid out. The first profit and commission post has not run.

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

These services are the architecture. Cognito, Amplify Hosting, the member and investment API, and one monthly EventBridge schedule are defined in CDK. S3 is not in use.

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

Steps 06 through 11 are DEPLOYED on that same API and table. There is no payout.

- Step 06: the owner submits one deposit reference. The server sets `pending_verification`.
- Step 07: an admin lists pending deposits and marks one `deposit_verified` or `rejected`.
- Step 08: an admin activates a `deposit_verified` investment. The server sets `active`.
- Step 09: the monthly job posts 8 percent profit as `USER#<sub>` / `PROFIT#<investmentId>#<period>`. Members read `GET /profits`.
- Step 10: a member requests a withdrawal of posted profit minus pending or approved requests. The request stays `pending_review`.
- Step 11: the same monthly job posts a 3 percent generation-1 commission and a 1 percent generation-2 commission. Members read `GET /commissions`.

`inv_099f028d-9317-430c-85b0-cb4ac14af129` is active. Its deposit reference is `QW-STEP06-HABIB-100`, and `activatedAt` is `2026-10-06T11:42:38.368Z`. The first profit and commission post is scheduled for 2026-11-01 01:00 UTC and has not run. A withdrawal cannot be verified until that post. Amplify job 15 for main `6362e96a3e3aac9c3048e3730799b14380f3f346` succeeded at `2026-10-06T14:30:52Z`.

`.env.example` keeps blank placeholders. Do not commit a production `.env` file. Wallet balances and payouts are not implemented.

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

Current Monthly Rate:
- 8 percent of the active investment amount, posted once per month. It is not a payout.

Referral rates:
- 3 percent generation 1, the direct sponsor
- 1 percent generation 2, the sponsor's sponsor

There is no extra direct-sponsor bonus and no payout. The first scheduled post is 2026-11-01 01:00 UTC. It has not run.

## Project checkpoint

See `docs/PROJECT_CHECKPOINT.md` after each completed step.
