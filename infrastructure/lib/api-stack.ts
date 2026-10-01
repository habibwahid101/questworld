import path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { CANONICAL_WEB_ORIGIN, PUBLIC_USER_POOL_CLIENT_ID, PUBLIC_USER_POOL_ID } from "./public-ids";

/**
 * Member profiles only. No wallets, investments, or commission tables.
 * Referral uniqueness is a separate REFERRAL#code item written in the same
 * DynamoDB transaction as the profile. That avoids a non-atomic GSI check.
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
      },
      bundling: {
        minify: false,
        sourceMap: false,
        externalModules: ["@aws-sdk/*"],
      },
    });
    membersFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:ConditionCheckItem"],
        resources: [table.tableArn],
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
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ["authorization", "content-type"],
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

    this.apiEndpoint = httpApi.apiEndpoint;
    new cdk.CfnOutput(this, "MembersApiUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "MembersTableName", { value: table.tableName });

    cdk.Tags.of(this).add("Project", "Questworld");
    cdk.Tags.of(this).add("Environment", "production");
    cdk.Tags.of(this).add("ManagedBy", "IaC");
  }
}
