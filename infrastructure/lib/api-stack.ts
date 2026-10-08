import path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { CANONICAL_WEB_ORIGIN, PUBLIC_USER_POOL_CLIENT_ID, PUBLIC_USER_POOL_ID } from "./public-ids";

/**
 * Member profiles and awaiting-deposit investments.
 * Investments use a separate table and Lambda. Sponsor lookup may read one member profile attribute.
 * Deposit screenshots go to a private bucket. Group changes use Cognito admin APIs.
 * Referral uniqueness stays a REFERRAL#code item in the members table.
 * GitHub authorization is not managed here.
 */
export class ApiStack extends cdk.Stack {
  public readonly apiEndpoint: string;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, "MembersTable", {
      tableName: "questworld-members",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const logGroup = new logs.LogGroup(this, "MembersLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const membersFn = new nodejs.NodejsFunction(this, "MembersFunction", {
      description: "Creates and updates Questra World member profiles. No financial processing.",
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, "../lambda/members/index.ts"),
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      logGroup,
      environment: {
        MEMBERS_TABLE_NAME: table.tableName,
        USER_POOL_ID: PUBLIC_USER_POOL_ID,
      },
      bundling: {
        minify: false,
        sourceMap: false,
        externalModules: ["@aws-sdk/*"],
      },
    });
    // TransactWrite Put actions are authorized as dynamodb:PutItem.
    // There is no ConditionCheck action in the transaction.
    membersFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Scan"],
        resources: [table.tableArn],
      }),
    );
    membersFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cognito-idp:ListUsersInGroup"],
        resources: [
          cdk.Stack.of(this).formatArn({
            service: "cognito-idp",
            resource: "userpool",
            resourceName: PUBLIC_USER_POOL_ID,
            arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          }),
        ],
      }),
    );

    const authorizer = new authorizers.HttpJwtAuthorizer(
      "CognitoAuthorizer",
      `https://cognito-idp.${this.region}.amazonaws.com/${PUBLIC_USER_POOL_ID}`,
      { jwtAudience: [PUBLIC_USER_POOL_CLIENT_ID] },
    );
    const integration = new integrations.HttpLambdaIntegration("MembersIntegration", membersFn);
    const httpApi = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: "questworld-members",
      corsPreflight: {
        allowOrigins: [CANONICAL_WEB_ORIGIN, "http://localhost:3000"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ["authorization", "content-type", "idempotency-key"],
        maxAge: cdk.Duration.hours(1),
      },
    });

    httpApi.addRoutes({
      path: "/me",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PATCH],
      integration,
      authorizer,
    });
    httpApi.addRoutes({
      path: "/me/initialize",
      methods: [apigwv2.HttpMethod.POST],
      integration,
      authorizer,
    });
    httpApi.addRoutes({
      path: "/admin/members",
      methods: [apigwv2.HttpMethod.GET],
      integration,
      authorizer,
    });

    const investmentsTable = new dynamodb.Table(this, "InvestmentsTable", {
      tableName: "questworld-investments",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const investmentLogs = new logs.LogGroup(this, "InvestmentsLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const depositProofs = new s3.Bucket(this, "DepositProofs", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const investmentsFn = new nodejs.NodejsFunction(this, "InvestmentsFunction", {
      description: "Records investments, profit, withdrawal requests, referral commissions, and deposit proof. No payout.",
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: path.join(__dirname, "../lambda/investments/index.ts"),
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      logGroup: investmentLogs,
      environment: {
        INVESTMENTS_TABLE_NAME: investmentsTable.tableName,
        MEMBERS_TABLE_NAME: table.tableName,
        USER_POOL_ID: PUBLIC_USER_POOL_ID,
        DEPOSIT_PROOF_BUCKET: depositProofs.bucketName,
      },
      bundling: {
        minify: false,
        sourceMap: false,
        externalModules: ["@aws-sdk/*"],
      },
    });
    investmentsFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query", "dynamodb:Scan", "dynamodb:UpdateItem"],
        resources: [investmentsTable.tableArn],
      }),
    );
    investmentsFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject"],
        resources: [depositProofs.arnForObjects("deposit-proofs/*")],
      }),
    );
    investmentsFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:AdminAddUserToGroup",
          "cognito-idp:AdminListGroupsForUser",
          "cognito-idp:AdminRemoveUserFromGroup",
          "cognito-idp:AdminUserGlobalSignOut",
          "cognito-idp:ListUsers",
          "cognito-idp:ListUsersInGroup",
        ],
        resources: [
          cdk.Stack.of(this).formatArn({
            service: "cognito-idp",
            resource: "userpool",
            resourceName: PUBLIC_USER_POOL_ID,
            arnFormat: cdk.ArnFormat.SLASH_RESOURCE_NAME,
          }),
        ],
      }),
    );
    investmentsFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem"],
        resources: [table.tableArn],
      }),
    );
    const investmentIntegration = new integrations.HttpLambdaIntegration("InvestmentsIntegration", investmentsFn);
    httpApi.addRoutes({
      path: "/investments",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: investmentIntegration,
      authorizer,
    });
    httpApi.addRoutes({
      path: "/investments/{investmentId}",
      methods: [apigwv2.HttpMethod.GET],
      integration: investmentIntegration,
      authorizer,
    });
    httpApi.addRoutes({
      path: "/investments/{investmentId}/deposit",
      methods: [apigwv2.HttpMethod.POST],
      integration: investmentIntegration,
      authorizer,
    });
    httpApi.addRoutes({
      path: "/admin/deposits",
      methods: [apigwv2.HttpMethod.GET],
      integration: investmentIntegration,
      authorizer,
    });
    httpApi.addRoutes({
      path: "/admin/investments",
      methods: [apigwv2.HttpMethod.GET],
      integration: investmentIntegration,
      authorizer,
    });
    httpApi.addRoutes({
      path: "/admin/profits",
      methods: [apigwv2.HttpMethod.GET],
      integration: investmentIntegration,
      authorizer,
    });
    httpApi.addRoutes({
      path: "/admin/commissions",
      methods: [apigwv2.HttpMethod.GET],
      integration: investmentIntegration,
      authorizer,
    });
    httpApi.addRoutes({
      path: "/admin/withdrawals",
      methods: [apigwv2.HttpMethod.GET],
      integration: investmentIntegration,
      authorizer,
    });
    httpApi.addRoutes({
      path: "/admin/deposits/{investmentId}/review",
      methods: [apigwv2.HttpMethod.POST],
      integration: investmentIntegration,
      authorizer,
    });
    httpApi.addRoutes({
      path: "/admin/deposits/{investmentId}/activate",
      methods: [apigwv2.HttpMethod.POST],
      integration: investmentIntegration,
      authorizer,
    });
    httpApi.addRoutes({
      path: "/deposit-address",
      methods: [apigwv2.HttpMethod.GET],
      integration: investmentIntegration,
      authorizer,
    });
    httpApi.addRoutes({
      path: "/admin/deposit-address",
      methods: [apigwv2.HttpMethod.PUT],
      integration: investmentIntegration,
      authorizer,
    });
    httpApi.addRoutes({
      path: "/admin/members/group",
      methods: [apigwv2.HttpMethod.POST],
      integration: investmentIntegration,
      authorizer,
    });
    httpApi.addRoutes({
      path: "/profits",
      methods: [apigwv2.HttpMethod.GET],
      integration: investmentIntegration,
      authorizer,
    });
    httpApi.addRoutes({
      path: "/commissions",
      methods: [apigwv2.HttpMethod.GET],
      integration: investmentIntegration,
      authorizer,
    });
    httpApi.addRoutes({
      path: "/withdrawals",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: investmentIntegration,
      authorizer,
    });
    new events.Rule(this, "MonthlyProfitSchedule", {
      description: "Posts one 8 percent profit ledger entry per active investment for the previous UTC month.",
      schedule: events.Schedule.cron({ minute: "0", hour: "1", day: "1" }),
      targets: [new targets.LambdaFunction(investmentsFn)],
    });

    this.apiEndpoint = httpApi.apiEndpoint;
    new cdk.CfnOutput(this, "MembersApiUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "MembersTableName", { value: table.tableName });
    new cdk.CfnOutput(this, "InvestmentsTableName", { value: investmentsTable.tableName });

    cdk.Tags.of(this).add("Project", "Questworld");
    cdk.Tags.of(this).add("Environment", "production");
    cdk.Tags.of(this).add("ManagedBy", "IaC");
  }
}
