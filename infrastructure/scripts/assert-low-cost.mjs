import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const forbidden = [
  "AWS::EC2::Instance",
  "AWS::EC2::NatGateway",
  "AWS::RDS::DBInstance",
  "AWS::RDS::DBCluster",
  "AWS::ElasticLoadBalancing::LoadBalancer",
  "AWS::ElasticLoadBalancingV2::LoadBalancer",
  "AWS::WAFv2::WebACL",
  "AWS::OpenSearchService::Domain",
  "AWS::Elasticsearch::Domain",
  "AWS::ElastiCache::CacheCluster",
  "AWS::ElastiCache::ReplicationGroup",
  "AWS::AppRunner::Service",
  "AWS::ECS::Service",
  "AWS::ECS::Cluster",
];

const required = [
  "AWS::Cognito::UserPool",
  "AWS::Cognito::UserPoolClient",
  "AWS::Cognito::UserPoolGroup",
  "AWS::Lambda::Function",
  "AWS::Amplify::App",
  "AWS::Amplify::Branch",
];

const outDir = path.resolve(import.meta.dirname, "../cdk.out");
const files = (await readdir(outDir)).filter((file) => file.endsWith(".template.json"));
if (files.length === 0) {
  throw new Error("No synthesized templates found.");
}

const found = new Set();
for (const file of files) {
  const template = JSON.parse(await readFile(path.join(outDir, file), "utf8"));
  for (const resource of Object.values(template.Resources ?? {})) {
    const type = resource.Type;
    found.add(type);
    if (forbidden.includes(type)) {
      throw new Error(`Forbidden resource in ${file}: ${type}`);
    }
    if (type === "AWS::Cognito::UserPoolClient") {
      const secret = resource.Properties?.GenerateSecret;
      if (secret === true) {
        throw new Error("Cognito app client must not have a secret.");
      }
    }
  }
}

for (const type of required) {
  if (!found.has(type)) {
    throw new Error(`Missing required resource type: ${type}`);
  }
}

const apiTemplate = JSON.parse(await readFile(path.join(outDir, "QuestworldApi.template.json"), "utf8"));
const memberActions = new Set();
const memberResources = [];
for (const resource of Object.values(apiTemplate.Resources ?? {})) {
  if (resource.Type !== "AWS::IAM::Policy") {
    continue;
  }
  for (const statement of resource.Properties?.PolicyDocument?.Statement ?? []) {
    const actions = Array.isArray(statement.Action) ? statement.Action : [statement.Action];
    for (const action of actions) {
      memberActions.add(action);
    }
    const resources = Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource];
    memberResources.push(...resources);
  }
}

const requiredMemberActions = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"];
for (const action of requiredMemberActions) {
  if (!memberActions.has(action)) {
    throw new Error(`QuestworldApi Lambda policy is missing ${action}.`);
  }
}
const rejectedMemberActions = ["dynamodb:TransactWriteItems", "dynamodb:ConditionCheckItem", "dynamodb:*"];
for (const action of rejectedMemberActions) {
  if (memberActions.has(action)) {
    throw new Error(`QuestworldApi Lambda policy must not grant ${action}.`);
  }
}
if (memberActions.size !== requiredMemberActions.length) {
  throw new Error(`QuestworldApi Lambda policy has unexpected DynamoDB actions: ${[...memberActions].sort().join(", ")}`);
}
const tableIds = new Set(
  Object.entries(apiTemplate.Resources ?? {})
    .filter(([, resource]) => resource.Type === "AWS::DynamoDB::Table")
    .map(([id]) => id),
);
if (memberResources.length !== 1 || memberResources[0]?.["Fn::GetAtt"]?.[1] !== "Arn" || !tableIds.has(memberResources[0]?.["Fn::GetAtt"]?.[0])) {
  throw new Error("QuestworldApi Lambda policy must target only the members table.");
}

console.log("Low-cost resource check passed.");
console.log([...found].sort().join("\n"));
