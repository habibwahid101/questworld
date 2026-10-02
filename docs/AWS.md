# Questra World AWS foundation

Region: `ap-south-1` (Mumbai).

Infrastructure is AWS CDK (TypeScript) in [`infrastructure/`](../infrastructure). The repository is the source of truth. Do not recreate these resources by hand in the console except for the GitHub authorization step described below.

No expensive always-on infrastructure is approved. Do not add EC2, RDS, NAT Gateway, ElastiCache, OpenSearch, WAF, App Runner, ECS, or load balancers without a new approval.

## Deployed state

| Item | Status |
| --- | --- |
| Region | `ap-south-1` |
| Cognito user pool | DEPLOYED. `ap-south-1_X2ibT0rBo` |
| Cognito app client | DEPLOYED. `4djbqt27hj54c3tu5754g4pvgt` (public, no secret) |
| Cognito group `Admins` | DEPLOYED |
| Amplify Hosting | DEPLOYED. App `d1xja8a1py5jgx`, branch `main`, stage PRODUCTION, Next.js SSR, auto-build on |
| GitHub connection | Amplify GitHub App for `https://github.com/habibwahid101/questworld`. No personal access token |
| Member API | DEPLOYED. `QuestworldApi`, `https://tp85xfa9z1.execute-api.ap-south-1.amazonaws.com` |
| DynamoDB `questworld-members` | DEPLOYED. ACTIVE, `PAY_PER_REQUEST` |
| Step 04 | COMPLETE. Production Amplify build for `6597138938f1a399289e7e10709312146cea1899` succeeded |

The frontend reads these public values through [`lib/auth/config.ts`](../lib/auth/config.ts). Blank `NEXT_PUBLIC_COGNITO_USER_POOL_ID` and `NEXT_PUBLIC_COGNITO_CLIENT_ID` use the deployed pool and client. Set those variables only to override them. Do not commit `.env`, `.env.local`, or `.env.production`. `.env.example` keeps empty placeholders.

Amplify Hosting is deployed. The canonical URL is `https://main.d1xja8a1py5jgx.amplifyapp.com`. Repository authorization uses the AWS Amplify GitHub App and is intentionally not stored as a token in CDK. Do not add `accessToken` or a Secrets Manager reference.

The three Cognito variables above are already present on the Amplify app. `amplify.yml` writes `NEXT_PUBLIC_*` into `.env.production` during the build. Blank Cognito overrides still fall back to `lib/auth/config.ts`.

`NEXT_PUBLIC_MEMBER_API_URL` is a public endpoint, not a secret. `QuestworldHosting` already sets it to `https://tp85xfa9z1.execute-api.ap-south-1.amazonaws.com`. Do not type that URL into the Amplify console, Secrets Manager, or SSM, and do not hard-code an execute-api URL in source.

## Resources defined in Step 03

| Resource | Why it exists | Cost behavior |
| --- | --- | --- |
| Cognito user pool `questworld-users` | Email and password accounts | Pay per monthly active user after the free tier. No hourly charge. |
| Cognito app client `questworld-web` | Public browser client. No client secret. | Included with the user pool. |
| Cognito group `Admins` | Separates administrators from members | No separate charge. |
| Lambda `AutoConfirmSignUp` | Confirms a new user and marks email verified during signup | Runs only on signup. 128 MB, 5 second timeout. |
| CloudWatch log group | Lambda logs, 7-day retention | Low storage cost. |
| Amplify app `questworld` | Next.js hosting on Amplify Hosting compute | Deployed as `d1xja8a1py5jgx`. Builds on push to `main`. |
| Amplify branch `main` | Production branch, `DeletionPolicy: Retain` | PRODUCTION, auto-build enabled. |
| IAM role for Amplify | Service role AWS requires for Amplify Hosting | Deployed with `QuestworldHosting`. Do not replace it. |

The signup Lambda sets `autoConfirmUser` and `autoVerifyEmail`. That is the locked product rule: signup does not show an email-verification screen or ask for a signup code. Forgot Password still works because Cognito treats the email as verified and can send a recovery code. The reset screen collects that recovery code. It is not signup verification.

Referral codes are not Cognito attributes. The browser keeps an optional code in `localStorage` under `qw_pending_referral_code` until `POST /me/initialize` succeeds. The API resolves the sponsor. The browser then deletes the key. The key is a handoff, not the genealogy record.

## Intentionally not created

- EC2
- RDS
- NAT Gateway
- ElastiCache
- OpenSearch
- WAF
- App Runner
- Load balancers
- DynamoDB financial tables, S3 application buckets, EventBridge schedules, payment wallets, and financial Lambdas
- A second Amplify app

## Member data (Step 04)

`QuestworldApi` is a separate deployed stack. It does not import `QuestworldAuth`. `QuestworldHosting` already contains `NEXT_PUBLIC_MEMBER_API_URL`. Step 04 is complete. Final diffs for `QuestworldAuth`, `QuestworldApi`, and `QuestworldHosting` are zero.

| Resource | Why it exists | Cost behavior |
| --- | --- | --- |
| DynamoDB table `questworld-members` | One profile per Cognito `sub`, plus one `REFERRAL#code` uniqueness item | DEPLOYED. ACTIVE, on-demand (`PAY_PER_REQUEST`). No idle server. Retained if the stack is deleted. |
| Lambda `MembersFunction` | `POST /me/initialize`, `GET /me`, `PATCH /me` | 256 MB, 10 second timeout. Runs only when called. |
| HTTP API `questworld-members` | Cognito JWT authorizer. No client secret. | Pay per request. |
| CloudWatch log group | Member Lambda logs, 7-day retention | Low storage cost. |

Profile items use `pk=USER#<sub>` and `sk=PROFILE`. Referral lookup items use `pk=REFERRAL#<code>` and `sk=OWNER`. Both writes happen in one transaction, so two members cannot receive the same code. There is no GSI.

The API reads `sub`, `email`, and `name` from the ID token. `PATCH /me` accepts only `name`, `phone`, and `country`. Referral code and sponsor are immutable. A missing or self-owned sponsor code does not create a profile. An existing member is returned unchanged if initialize is repeated.

Step 04 is complete. `QuestworldApi` is deployed. The members API is `https://tp85xfa9z1.execute-api.ap-south-1.amazonaws.com`. The production Amplify build succeeded. Do not redeploy these stacks while their diffs are zero.

If a later change touches both stacks, deploy `QuestworldApi` before `QuestworldHosting`. A Hosting change must not replace the Amplify app, the `main` branch, the service role, or the existing Cognito variables, and it must not remove the GitHub App connection.

```bash
cd infrastructure
npx cdk deploy QuestworldApi --require-approval broadening
npx cdk deploy QuestworldHosting --require-approval broadening
```

Do not run `cdk deploy --all`. `.env.example` stays blank. The public API URL stays in the Amplify environment variable, not in source.

## CDK assets

`QuestworldAuth` still uses an inline signup Lambda. `QuestworldApi` bundles the member Lambda and is already deployed, so the CDK bootstrap toolkit in `ap-south-1` is already present. Bootstrap is a toolkit bucket and roles, not an application server. Do not bootstrap again unless CDK asks for it. Do not create EC2, RDS, NAT, ElastiCache, OpenSearch, or WAF.

## Deploy

Cognito, Amplify, and the member API are already deployed in `ap-south-1`. Final diffs for `QuestworldAuth`, `QuestworldApi`, and `QuestworldHosting` are zero. Do not redeploy a stack whose diff is empty.

If infrastructure itself changes later, run these from an authorized `questworld-admin` session in AWS CloudShell, or from any shell that already has that role. Do not create access keys. Do not use the root account.

```bash
cd infrastructure
npm ci
npx cdk synth
node scripts/assert-low-cost.mjs
npx cdk diff QuestworldAuth
npx cdk diff QuestworldApi
npx cdk diff QuestworldHosting
npx cdk deploy QuestworldApi --require-approval broadening
npx cdk deploy QuestworldHosting --require-approval broadening
```

Do not run `cdk deploy --all`. Do not deploy a stack whose diff is empty. If a future change touches both the API and Hosting, deploy `QuestworldApi` before `QuestworldHosting`. Stop if Hosting proposes replacing the Amplify app or branch, disconnecting GitHub, or changing the Cognito variables.

## GitHub connection for Amplify

The canonical Amplify app `d1xja8a1py5jgx` is connected to `https://github.com/habibwahid101/questworld` through the AWS Amplify GitHub App. CDK does not store a personal access token. Do not merge `step-06a-amplify-github` and do not reference `questworld/amplify/github-access-token`.

The `main` branch is CloudFormation-owned by `QuestworldHosting`, stage PRODUCTION, framework Next.js - SSR, auto-build enabled, and retained on deletion.

## First administrator

Signup never adds anyone to `Admins`. After you have created your own user through `/register`, an authorized operator can grant admin access:

```bash
aws cognito-idp admin-add-user-to-group \
  --region ap-south-1 \
  --user-pool-id ap-south-1_X2ibT0rBo \
  --username "you@example.com" \
  --group-name Admins
```

Run that in CloudShell as `questworld-admin`. Do not hard-code an admin email in the frontend. This step does not create that user.

## Teardown

```bash
cd infrastructure
npx cdk destroy QuestworldApi
```

Do not destroy `QuestworldAuth` or `QuestworldHosting` from this step. The user pool and the members table use `RemovalPolicy.RETAIN`. The Amplify `main` branch is also retained. Delete retained resources only when you intend to remove accounts or member profiles.

## Route protection

Member routes and `/admin` wait for the Cognito session in the browser. Unauthenticated visitors are sent to `/login`. `/admin` also requires the `Admins` group on the ID token. Session tokens stay in Amplify storage. Passwords are not stored. Tokens are not written to the console.
