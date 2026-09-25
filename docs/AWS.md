# Questra World AWS foundation

Region: `ap-south-1` (Mumbai).

Infrastructure is AWS CDK (TypeScript) in [`infrastructure/`](../infrastructure). The repository is the source of truth. Do not recreate these resources by hand in the console except for the GitHub authorization step described below.

No expensive always-on infrastructure is approved. Do not add EC2, RDS, NAT Gateway, ElastiCache, OpenSearch, WAF, App Runner, ECS, or load balancers without a new approval.

## Resources defined in Step 03

| Resource | Why it exists | Cost behavior |
| --- | --- | --- |
| Cognito user pool `questworld-users` | Email and password accounts | Pay per monthly active user after the free tier. No hourly charge. |
| Cognito app client `questworld-web` | Public browser client. No client secret. | Included with the user pool. |
| Cognito group `Admins` | Separates administrators from members | No separate charge. |
| Lambda `AutoConfirmSignUp` | Confirms a new user and marks email verified during signup | Runs only on signup. 128 MB, 5 second timeout. |
| CloudWatch log group | Lambda logs, 7-day retention | Low storage cost. |
| Amplify app `questworld` | Next.js hosting on Amplify Hosting compute | Build minutes and hosting requests. No server you keep running. |
| Amplify branch `main` | Production branch record | Builds only after GitHub is connected. |
| IAM role for Amplify | Service role AWS requires for Amplify Hosting | No charge for the role itself. |

The signup Lambda sets `autoConfirmUser` and `autoVerifyEmail`. That is the locked product rule: signup does not show an email-verification screen or ask for a signup code. Forgot Password still works because Cognito treats the email as verified and can send a recovery code. The reset screen collects that recovery code. It is not signup verification.

Referral codes are not Cognito attributes. After registration the browser keeps an optional code in `localStorage` under `qw_pending_referral_code`. Step 04 must copy that into DynamoDB and then delete the key. It is a handoff, not the genealogy record.

## Intentionally not created

- EC2
- RDS
- NAT Gateway
- ElastiCache
- OpenSearch
- WAF
- App Runner
- Load balancers
- DynamoDB, S3 application buckets, EventBridge schedules, payment wallets, and financial Lambdas

CDK bootstrap is not part of this stack. The Lambda source is inline, so synth does not publish a deployment asset. If a later change adds an asset, bootstrap is a one-time toolkit bucket and roles, not an application server. Do not bootstrap unless CDK asks for it.

## Deploy

Run these from an authorized `questworld-admin` session in AWS CloudShell, or from any shell that already has that role. Do not create access keys. Do not use the root account.

```bash
cd infrastructure
npm ci
npx cdk synth
node scripts/assert-low-cost.mjs
npx cdk deploy --all --require-approval broadening
```

Copy the outputs into Amplify environment variables or `.env.local` (never commit `.env.local`):

- `NEXT_PUBLIC_AWS_REGION=ap-south-1`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_COGNITO_CLIENT_ID`

`amplify.yml` writes `NEXT_PUBLIC_*` into `.env.production` during the Amplify build so the Next.js client can see them.

## GitHub connection for Amplify

CDK creates the Amplify app and the `main` branch without a GitHub token. Connecting the repository requires an interactive GitHub authorization that must not be replaced with a personal access token in this repo or in chat.

Manual step, as `questworld-admin`:

1. Open Amplify in `ap-south-1`.
2. Open the `questworld` app created by `QuestworldHosting`.
3. Choose to connect a GitHub repository and approve the AWS Amplify GitHub App for `habibwahid101/questworld`.
4. Select branch `main`.
5. Confirm the platform is Web Compute (Next.js SSR) and that the existing `amplify.yml` is used.
6. Start a production build only after the Cognito environment variables above are set on the app.

Until that authorization is completed, Amplify is defined but not connected, and production hosting is not deployed.

## First administrator

Signup never adds anyone to `Admins`. After you have created your own user through `/register`, an authorized operator can grant admin access:

```bash
aws cognito-idp admin-add-user-to-group \
  --region ap-south-1 \
  --user-pool-id "$NEXT_PUBLIC_COGNITO_USER_POOL_ID" \
  --username "you@example.com" \
  --group-name Admins
```

Run that in CloudShell as `questworld-admin`. Do not hard-code an admin email in the frontend. This step does not create that user.

## Teardown

```bash
cd infrastructure
npx cdk destroy --all
```

The user pool uses `RemovalPolicy.RETAIN`, so stack deletion does not delete accounts. Delete the retained pool in Cognito only when you intend to remove users. Amplify app, branch, Lambda, and log group are removed with the stacks.

## Route protection

Member routes and `/admin` wait for the Cognito session in the browser. Unauthenticated visitors are sent to `/login`. `/admin` also requires the `Admins` group on the ID token. Session tokens stay in Amplify storage. Passwords are not stored. Tokens are not written to the console.
