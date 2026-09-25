import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

/**
 * Signup does not ask the user to verify email.
 * This Pre Sign-up trigger confirms the user and marks the email verified
 * so the account is usable immediately and Forgot Password can still send mail.
 * It is not a signup verification screen and it does not collect a code.
 */
const AUTO_CONFIRM_HANDLER = `
exports.handler = async (event) => {
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;
  return event;
};
`;

export class AuthStack extends cdk.Stack {
  readonly userPoolId: string;
  readonly userPoolClientId: string;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    const autoConfirmLogGroup = new logs.LogGroup(this, "AutoConfirmLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const autoConfirm = new lambda.Function(this, "AutoConfirmSignUp", {
      description: "Confirms Questra World signups immediately and marks email verified. No signup code is required.",
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(AUTO_CONFIRM_HANDLER),
      timeout: cdk.Duration.seconds(5),
      memorySize: 128,
      logGroup: autoConfirmLogGroup,
    });

    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: "questworld-users",
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      mfa: cognito.Mfa.OFF,
      lambdaTriggers: {
        preSignUp: autoConfirm,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const client = userPool.addClient("WebClient", {
      userPoolClientName: "questworld-web",
      generateSecret: false,
      authFlows: {
        userSrp: true,
      },
      preventUserExistenceErrors: true,
      disableOAuth: true,
    });

    new cognito.CfnUserPoolGroup(this, "AdminsGroup", {
      userPoolId: userPool.userPoolId,
      groupName: "Admins",
      description: "Questra World administrators. Membership is assigned explicitly. Signup never adds this group.",
      precedence: 1,
    });

    this.userPoolId = userPool.userPoolId;
    this.userPoolClientId = client.userPoolClientId;

    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: client.userPoolClientId });
    new cdk.CfnOutput(this, "Region", { value: this.region });

    cdk.Tags.of(this).add("Project", "Questworld");
    cdk.Tags.of(this).add("Environment", "production");
    cdk.Tags.of(this).add("ManagedBy", "IaC");
  }
}
