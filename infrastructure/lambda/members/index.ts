import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  handleMemberApi,
  type CreateResult,
  type MemberRecord,
  type MemberStore,
} from "../../../lib/members/service";

const PROFILE_SK = "PROFILE";
const OWNER_SK = "OWNER";

type ApiGatewayEvent = {
  rawPath?: string;
  body?: string | null;
  isBase64Encoded?: boolean;
  requestContext?: {
    http?: { method?: string };
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  };
};

const document = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export async function handler(event: ApiGatewayEvent): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> {
  const tableName = process.env.MEMBERS_TABLE_NAME;
  if (!tableName) {
    return json(500, { error: "configuration", message: "Member storage is not configured." });
  }

  let body: unknown;
  if (event.body) {
    const text = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      return json(400, { error: "invalid_body", message: "Request body must be JSON." });
    }
  }

  const result = await handleMemberApi({
    method: event.requestContext?.http?.method ?? "GET",
    path: event.rawPath ?? "/",
    claims: event.requestContext?.authorizer?.jwt?.claims,
    body,
    store: createDynamoMemberStore(tableName),
  });

  return json(result.statusCode, result.body);
}

function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function createDynamoMemberStore(tableName: string): MemberStore {
  return {
    async getByUserId(userId) {
      const response = await document.send(
        new GetCommand({
          TableName: tableName,
          Key: { pk: userKey(userId), sk: PROFILE_SK },
        }),
      );
      return response.Item ? itemToMember(response.Item) : null;
    },
    async getUserIdByReferralCode(code) {
      const response = await document.send(
        new GetCommand({
          TableName: tableName,
          Key: { pk: referralKey(code), sk: OWNER_SK },
        }),
      );
      const userId = response.Item?.userId;
      return typeof userId === "string" ? userId : null;
    },
    async createMember(member) {
      try {
        await document.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: tableName,
                  Item: memberToItem(member),
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
              {
                Put: {
                  TableName: tableName,
                  Item: {
                    pk: referralKey(member.referralCode),
                    sk: OWNER_SK,
                    userId: member.userId,
                  },
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
            ],
          }),
        );
        return "created";
      } catch (caught) {
        return cancellationResult(caught);
      }
    },
    async updateProfile(userId, patch) {
      const names: Record<string, string> = { "#updatedAt": "updatedAt" };
      const values: Record<string, unknown> = { ":updatedAt": patch.updatedAt };
      const sets = ["#updatedAt = :updatedAt"];
      if (patch.name !== undefined) {
        names["#name"] = "name";
        values[":name"] = patch.name;
        sets.push("#name = :name");
      }
      if (patch.phone !== undefined) {
        names["#phone"] = "phone";
        values[":phone"] = patch.phone;
        sets.push("#phone = :phone");
      }
      if (patch.country !== undefined) {
        names["#country"] = "country";
        values[":country"] = patch.country;
        sets.push("#country = :country");
      }
      try {
        const response = await document.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { pk: userKey(userId), sk: PROFILE_SK },
            UpdateExpression: `SET ${sets.join(", ")}`,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ConditionExpression: "attribute_exists(pk)",
            ReturnValues: "ALL_NEW",
          }),
        );
        return response.Attributes ? itemToMember(response.Attributes) : null;
      } catch (caught) {
        if (isConditionalFailure(caught)) {
          return null;
        }
        throw caught;
      }
    },
  };
}

function cancellationResult(caught: unknown): CreateResult {
  const reasons = cancellationReasons(caught);
  if (reasons.some((reason) => reason === "ConditionalCheckFailed" || reason === "TransactionConflict")) {
    const profileFailed = reasons[0] === "ConditionalCheckFailed";
    const referralFailed = reasons[1] === "ConditionalCheckFailed";
    if (profileFailed) {
      return "exists";
    }
    if (referralFailed) {
      return "referral-taken";
    }
  }
  throw caught;
}

function cancellationReasons(caught: unknown): string[] {
  if (!caught || typeof caught !== "object") {
    return [];
  }
  const record = caught as {
    name?: string;
    CancellationReasons?: Array<{ Code?: string }>;
  };
  if (record.name !== "TransactionCanceledException") {
    return [];
  }
  return (record.CancellationReasons ?? []).map((reason) => reason.Code ?? "");
}

function isConditionalFailure(caught: unknown): boolean {
  return Boolean(
    caught &&
      typeof caught === "object" &&
      (caught as { name?: string }).name === "ConditionalCheckFailedException",
  );
}

function userKey(userId: string): string {
  return `USER#${userId}`;
}

function referralKey(code: string): string {
  return `REFERRAL#${code}`;
}

function memberToItem(member: MemberRecord): Record<string, unknown> {
  return {
    pk: userKey(member.userId),
    sk: PROFILE_SK,
    ...member,
  };
}

function itemToMember(item: Record<string, unknown>): MemberRecord {
  return {
    userId: requiredString(item.userId),
    email: requiredString(item.email),
    name: requiredString(item.name),
    phone: optionalString(item.phone),
    country: optionalString(item.country),
    referralCode: requiredString(item.referralCode),
    sponsorUserId: optionalString(item.sponsorUserId),
    sponsorReferralCode: optionalString(item.sponsorReferralCode),
    createdAt: requiredString(item.createdAt),
    updatedAt: requiredString(item.updatedAt),
    status: "active",
  };
}

function requiredString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}
