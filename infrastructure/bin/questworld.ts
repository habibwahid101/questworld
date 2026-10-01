#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { ApiStack } from "../lib/api-stack";
import { AuthStack } from "../lib/auth-stack";
import { HostingStack } from "../lib/hosting-stack";

const app = new cdk.App();
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: "ap-south-1",
};

const auth = new AuthStack(app, "QuestworldAuth", {
  env,
  description: "Questra World Cognito authentication. No financial data stores.",
});

const api = new ApiStack(app, "QuestworldApi", {
  env,
  description: "Questra World member profiles. No financial processing.",
});

new HostingStack(app, "QuestworldHosting", {
  env,
  description: "Questra World Amplify Hosting app. GitHub connection is a separate authorization step.",
  userPoolId: auth.userPoolId,
  userPoolClientId: auth.userPoolClientId,
  membersApiUrl: api.apiEndpoint,
});
