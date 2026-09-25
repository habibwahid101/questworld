import * as cdk from "aws-cdk-lib";
import * as amplify from "aws-cdk-lib/aws-amplify";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

type HostingStackProps = cdk.StackProps & {
  userPoolId: string;
  userPoolClientId: string;
};

/**
 * Creates the Amplify Hosting app for Next.js compute without a GitHub token.
 * Connecting habibwahid101/questworld requires the Amplify console GitHub authorization.
 * Do not put a personal access token in this repository.
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
      ],
      tags: [
        { key: "Project", value: "Questworld" },
        { key: "Environment", value: "production" },
        { key: "ManagedBy", value: "IaC" },
      ],
    });

    new amplify.CfnBranch(this, "MainBranch", {
      appId: app.attrAppId,
      branchName: "main",
      stage: "PRODUCTION",
      enableAutoBuild: true,
      framework: "Next.js - SSR",
    });

    new cdk.CfnOutput(this, "AmplifyAppId", { value: app.attrAppId });
    new cdk.CfnOutput(this, "AmplifyDefaultDomain", { value: app.attrDefaultDomain });

    cdk.Tags.of(this).add("Project", "Questworld");
    cdk.Tags.of(this).add("Environment", "production");
    cdk.Tags.of(this).add("ManagedBy", "IaC");
  }
}
