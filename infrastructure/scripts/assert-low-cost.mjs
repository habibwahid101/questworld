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

console.log("Low-cost resource check passed.");
console.log([...found].sort().join("\n"));
