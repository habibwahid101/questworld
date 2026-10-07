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
const tables = new Map();
for (const [id, resource] of Object.entries(apiTemplate.Resources ?? {})) {
  if (resource.Type === "AWS::DynamoDB::Table") {
    tables.set(id, resource.Properties?.TableName);
    if (resource.Properties?.TableName === "questworld-investments") {
      if (resource.Properties.BillingMode !== "PAY_PER_REQUEST" || resource.Properties.GlobalSecondaryIndexes) {
        throw new Error("questworld-investments must be on-demand and must not have a GSI.");
      }
      if (resource.DeletionPolicy !== "Retain") {
        throw new Error("questworld-investments must be retained.");
      }
    }
  }
}

const actionsByTable = new Map();
const otherActions = [];
for (const resource of Object.values(apiTemplate.Resources ?? {})) {
  if (resource.Type !== "AWS::IAM::Policy") {
    continue;
  }
  for (const statement of resource.Properties?.PolicyDocument?.Statement ?? []) {
    const actions = Array.isArray(statement.Action) ? statement.Action : [statement.Action];
    const resources = Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource];
    if (actions.every((action) => String(action).startsWith("dynamodb:"))) {
      if (resources.length !== 1) {
        throw new Error("Each QuestworldApi DynamoDB statement must target one table.");
      }
      const tableId = resources[0]?.["Fn::GetAtt"]?.[0];
      const tableName = tables.get(tableId);
      if (!tableName || resources[0]?.["Fn::GetAtt"]?.[1] !== "Arn") {
        throw new Error("QuestworldApi DynamoDB access must use a table ARN.");
      }
      const granted = actionsByTable.get(tableName) ?? new Set();
      for (const action of actions) {
        granted.add(action);
      }
      actionsByTable.set(tableName, granted);
      continue;
    }
    otherActions.push(actions.map(String));
  }
}

function expectExactActions(tableName, expected) {
  const actual = actionsByTable.get(tableName);
  if (!actual) {
    throw new Error(`QuestworldApi is missing a policy for ${tableName}.`);
  }
  const actualList = [...actual].sort();
  const expectedList = [...expected].sort();
  if (actualList.join(",") !== expectedList.join(",")) {
    throw new Error(`${tableName} policy is ${actualList.join(", ")}`);
  }
}

expectExactActions("questworld-members", ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"]);
expectExactActions("questworld-investments", [
  "dynamodb:GetItem",
  "dynamodb:PutItem",
  "dynamodb:Query",
  "dynamodb:Scan",
  "dynamodb:UpdateItem",
]);
if (actionsByTable.size !== 2) {
  throw new Error(`Unexpected DynamoDB policy targets: ${[...actionsByTable.keys()].join(", ")}`);
}

const schedules = Object.values(apiTemplate.Resources ?? {}).filter((resource) => resource.Type === "AWS::Events::Rule");
if (schedules.length !== 1 || !String(schedules[0].Properties?.ScheduleExpression ?? "").startsWith("cron(")) {
  throw new Error("QuestworldApi must contain one monthly profit cron rule.");
}
if ([...tables.values()].some((name) => name !== "questworld-members" && name !== "questworld-investments")) {
  throw new Error("QuestworldApi has an unexpected table.");
}

const buckets = Object.values(apiTemplate.Resources ?? {}).filter((resource) => resource.Type === "AWS::S3::Bucket");
if (buckets.length !== 1) {
  throw new Error("QuestworldApi must contain one private deposit-proof bucket.");
}
const access = buckets[0].Properties?.PublicAccessBlockConfiguration ?? {};
if (!access.BlockPublicAcls || !access.BlockPublicPolicy || !access.IgnorePublicAcls || !access.RestrictPublicBuckets) {
  throw new Error("The deposit-proof bucket must block public access.");
}
if (buckets[0].Properties?.WebsiteConfiguration || buckets[0].DeletionPolicy !== "Retain") {
  throw new Error("The deposit-proof bucket must stay private and retained.");
}
const flatActions = otherActions.flat();
if (flatActions.some((action) => action === "s3:*" || action.startsWith("s3:") && action !== "s3:PutObject")) {
  throw new Error(`Deposit proof storage allows unexpected S3 actions: ${flatActions.join(", ")}`);
}
if (!flatActions.includes("s3:PutObject")) {
  throw new Error("Deposit proof storage is missing s3:PutObject.");
}
const cognitoActions = [
  "cognito-idp:AdminAddUserToGroup",
  "cognito-idp:AdminListGroupsForUser",
  "cognito-idp:AdminRemoveUserFromGroup",
  "cognito-idp:AdminUserGlobalSignOut",
  "cognito-idp:ListUsers",
  "cognito-idp:ListUsersInGroup",
];
for (const action of cognitoActions) {
  if (!flatActions.includes(action)) {
    throw new Error(`Administrator group management is missing ${action}.`);
  }
}
if (flatActions.some((action) => action.startsWith("cognito-idp:") && !cognitoActions.includes(action))) {
  throw new Error("Administrator group management grants an unexpected Cognito action.");
}

console.log("Low-cost resource check passed.");
console.log([...found].sort().join("\n"));
