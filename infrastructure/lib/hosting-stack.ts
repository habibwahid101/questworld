import * as cdk from "aws-cdk-lib";
import * as amplify from "aws-cdk-lib/aws-amplify";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

type HostingStackProps = cdk.StackProps & {
  userPoolId: string;
  userPoolClientId: string;
  membersApiUrl: string;
};

/**
 * Amplify Hosting for the existing questworld app.
 * GitHub repository authorization is completed through the AWS Amplify
 * GitHub App in the AWS Console and intentionally is not managed with a
 * PAT in CDK. Do not add an access token or a Secrets Manager reference.
 */
export class HostingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: HostingStackProps) {
    super(scope, id, props);

    const serviceRole = new iam.Role(this, "AmplifyServiceRole", {
      assumedBy: new iam.ServicePrincipal("amplify.amazonaws.com"),
      description: "Service role Amplify Hosting uses for Questworld SSR logs and deployments.",
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess-Amplify"),
      ],
    });

    const app = new amplify.CfnApp(this, "App", {
      name: "questworld",
      description: "Questra World Next.js application.",
      platform: "WEB_COMPUTE",
      iamServiceRole: serviceRole.roleArn,
      environmentVariables: [
        { name: "NEXT_PUBLIC_AWS_REGION", value: "ap-south-1" },
        { name: "NEXT_PUBLIC_COGNITO_USER_POOL_ID", value: props.userPoolId },
        { name: "NEXT_PUBLIC_COGNITO_CLIENT_ID", value: props.userPoolClientId },
        { name: "NEXT_PUBLIC_MEMBER_API_URL", value: props.membersApiUrl },
      ],
      tags: [
        { key: "Project", value: "Questworld" },
        { key: "Environment", value: "production" },
        { key: "ManagedBy", value: "IaC" },
      ],
    });

    const mainBranch = new amplify.CfnBranch(this, "MainBranch", {
      appId: app.attrAppId,
      branchName: "main",
      stage: "PRODUCTION",
      enableAutoBuild: true,
      framework: "Next.js - SSR",
    });
    mainBranch.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN, {
      applyToUpdateReplacePolicy: false,
    });

    new cdk.CfnOutput(this, "AmplifyAppId", { value: app.attrAppId });
    new cdk.CfnOutput(this, "AmplifyDefaultDomain", { value: app.attrDefaultDomain });

    cdk.Tags.of(this).add("Project", "Questworld");
    cdk.Tags.of(this).add("Environment", "production");
    cdk.Tags.of(this).add("ManagedBy", "IaC");
  }
}
