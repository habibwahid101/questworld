import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { CognitoIdentityProviderClient, ListUsersInGroupCommand } from "@aws-sdk/client-cognito-identity-provider";
import {
  checkReferralCode,
  handleMemberApi,
  MemberRequestError,
  profilePhotoKey,
  registrationPhoneKey,
  type CreateResult,
  type MemberCompletion,
  type MemberRecord,
  type MemberStore,
  type ProfilePhotoStore,
} from "../../../lib/members/service";

const PROFILE_SK = "PROFILE";
const OWNER_SK = "OWNER";
const UNIQUE_SK = "UNIQUE";

type ApiGatewayEvent = {
  rawPath?: string;
  queryStringParameters?: Record<string, string | undefined> | null;
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
const cognito = new CognitoIdentityProviderClient({});
const photos = new S3Client({});

export async function handler(event: ApiGatewayEvent): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> {
  const tableName = process.env.MEMBERS_TABLE_NAME;
  if (!tableName) {
    return json(500, { error: "configuration", message: "Member storage is not configured." });
  }

  const method = (event.requestContext?.http?.method ?? "GET").toUpperCase();
  if (method === "GET" && (event.rawPath ?? "").replace(/\/+$/, "") === "/members/referral-check") {
    const result = await checkReferralCode(createDynamoMemberStore(tableName), event.queryStringParameters?.code);
    return json(200, result);
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
    adminUserIds: process.env.USER_POOL_ID ? () => listAdminIdentifiers(process.env.USER_POOL_ID as string) : undefined,
    photos: process.env.PROFILE_PHOTO_BUCKET ? createProfilePhotoStore(process.env.PROFILE_PHOTO_BUCKET) : undefined,
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

export function createDynamoMemberStore(tableName: string, client: DynamoDBDocumentClient = document): MemberStore {
  return {
    async getByUserId(userId) {
      const response = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: { pk: userKey(userId), sk: PROFILE_SK },
          ConsistentRead: true,
        }),
      );
      return response.Item ? itemToMember(response.Item) : null;
    },
    async getPhoneOwner(phone) {
      const key = registrationPhoneKey(phone);
      if (!key) {
        return null;
      }
      const response = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: { pk: phoneKey(phone), sk: UNIQUE_SK },
          ConsistentRead: true,
        }),
      );
      const owner = response.Item?.userId;
      return typeof owner === "string" ? owner : null;
    },
    async getUserIdByReferralCode(code) {
      const response = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: { pk: referralKey(code), sk: OWNER_SK },
        }),
      );
      const userId = response.Item?.userId;
      return typeof userId === "string" ? userId : null;
    },
    async listMembers() {
      const matches: Record<string, unknown>[] = [];
      let startKey: Record<string, unknown> | undefined;
      let read = 0;
      do {
        const response = await client.send(
          new ScanCommand({
            TableName: tableName,
            FilterExpression: "sk = :profile AND begins_with(pk, :user)",
            ExpressionAttributeValues: { ":profile": PROFILE_SK, ":user": "USER#" },
            ExclusiveStartKey: startKey,
            Limit: 50,
          }),
        );
        read += response.ScannedCount ?? 0;
        matches.push(...(response.Items ?? []));
        startKey = response.LastEvaluatedKey;
      } while (startKey && read < 200 && matches.length < 200);
      return matches.map((item) => itemToMember(item));
    },
    async findRegistrationConflict({ userId, email, phone }) {
      const emailKey = email.trim().toLowerCase();
      const normalizedPhone = registrationPhoneKey(phone);
      if (normalizedPhone) {
        const index = await client.send(
          new GetCommand({
            TableName: tableName,
            Key: { pk: phoneKey(phone), sk: UNIQUE_SK },
            ConsistentRead: true,
          }),
        );
        const owner = index.Item?.userId;
        if (typeof owner === "string" && owner.length > 0 && owner !== userId) {
          return "phone";
        }
      }
      let emailConflict = false;
      let startKey: Record<string, unknown> | undefined;
      do {
        const response = await client.send(
          new ScanCommand({
            TableName: tableName,
            FilterExpression: "sk = :profile",
            ExpressionAttributeValues: { ":profile": PROFILE_SK },
            ExclusiveStartKey: startKey,
          }),
        );
        for (const item of response.Items ?? []) {
          const member = itemToMember(item);
          if (member.userId === userId) {
            continue;
          }
          if (normalizedPhone && registrationPhoneKey(member.phone) === normalizedPhone) {
            return "phone";
          }
          if (member.email.trim().toLowerCase() === emailKey) {
            emailConflict = true;
          }
        }
        startKey = response.LastEvaluatedKey;
      } while (startKey);
      return emailConflict ? "email" : null;
    },
    async createMember(member) {
      try {
        await client.send(
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
              {
                Put: {
                  TableName: tableName,
                  Item: {
                    pk: emailKey(member.email),
                    sk: UNIQUE_SK,
                    userId: member.userId,
                  },
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
              ...(registrationPhoneKey(member.phone)
                ? [
                    {
                      Put: {
                        TableName: tableName,
                        Item: {
                          pk: phoneKey(member.phone),
                          sk: UNIQUE_SK,
                          userId: member.userId,
                        },
                        ConditionExpression: "attribute_not_exists(pk)",
                      },
                    },
                  ]
                : []),
            ],
          }),
        );
        return "created";
      } catch (caught) {
        return cancellationResult(caught);
      }
    },
    async completeMember(userId, fill: MemberCompletion) {
      const names: Record<string, string> = {};
      const values: Record<string, string> = {};
      const sets: string[] = [];
      const conditions = ["attribute_exists(pk)", "email = :email", "referralCode = :referralCode"];
      values[":email"] = fill.email;
      values[":referralCode"] = fill.referralCode;
      const allowBlankIdentity = (attribute: "sponsorUserId" | "sponsorReferralCode", value: string | null) => {
        if (value) {
          conditions.push(`${attribute} = :${attribute}`);
          values[`:${attribute}`] = value;
          return;
        }
        names[`#${attribute}`] = attribute;
        values[":blank"] = "";
        values[":nullType"] = "NULL";
        conditions.push(`(attribute_not_exists(#${attribute}) OR #${attribute} = :blank OR attribute_type(#${attribute}, :nullType))`);
      };
      allowBlankIdentity("sponsorUserId", fill.sponsorUserId);
      allowBlankIdentity("sponsorReferralCode", fill.sponsorReferralCode);
      const setIfEmpty = (attribute: string, value: string | null) => {
        if (!value) {
          return;
        }
        names[`#${attribute}`] = attribute;
        values[`:${attribute}`] = value;
        values[":blank"] = "";
        values[":nullType"] = "NULL";
        sets.push(`#${attribute} = :${attribute}`);
        conditions.push(`(attribute_not_exists(#${attribute}) OR #${attribute} = :blank OR attribute_type(#${attribute}, :nullType))`);
      };
      setIfEmpty("firstName", fill.firstName);
      setIfEmpty("lastName", fill.lastName);
      setIfEmpty("phone", fill.phone);
      setIfEmpty("country", fill.country);
      setIfEmpty("transactionPasswordHash", fill.transactionPasswordHash);
      setIfEmpty("name", fill.name);
      if (sets.length > 0) {
        names["#updatedAt"] = "updatedAt";
        values[":updatedAt"] = fill.updatedAt;
        sets.push("#updatedAt = :updatedAt");
      }
      const phoneForIndex = fill.phone ?? fill.ensurePhone;
      const items: NonNullable<TransactWriteCommandInput["TransactItems"]> = [];
      const expressionNames = Object.keys(names).length > 0 ? names : undefined;
      if (sets.length > 0) {
        items.push({
          Update: {
            TableName: tableName,
            Key: { pk: userKey(userId), sk: PROFILE_SK },
            UpdateExpression: `SET ${sets.join(", ")}`,
            ConditionExpression: conditions.join(" AND "),
            ...(expressionNames ? { ExpressionAttributeNames: expressionNames } : {}),
            ExpressionAttributeValues: values,
          },
        });
      } else if (registrationPhoneKey(phoneForIndex)) {
        items.push({
          ConditionCheck: {
            TableName: tableName,
            Key: { pk: userKey(userId), sk: PROFILE_SK },
            ConditionExpression: conditions.join(" AND "),
            ...(expressionNames ? { ExpressionAttributeNames: expressionNames } : {}),
            ExpressionAttributeValues: values,
          },
        });
      }
      const phoneIndex = registrationPhoneKey(phoneForIndex) ? items.length : -1;
      if (phoneIndex >= 0 && phoneForIndex) {
        items.push({
          Put: {
            TableName: tableName,
            Item: {
              pk: phoneKey(phoneForIndex),
              sk: UNIQUE_SK,
              userId,
            },
            ConditionExpression: "attribute_not_exists(pk) OR userId = :owner",
            ExpressionAttributeValues: { ":owner": userId },
          },
        });
      }
      if (items.length === 0) {
        const current = await client.send(
          new GetCommand({ TableName: tableName, Key: { pk: userKey(userId), sk: PROFILE_SK }, ConsistentRead: true }),
        );
        return current.Item ? { result: "updated" as const, member: itemToMember(current.Item) } : { result: "missing" as const, member: null };
      }
      try {
        await client.send(new TransactWriteCommand({ TransactItems: items }));
        const saved = await client.send(
          new GetCommand({ TableName: tableName, Key: { pk: userKey(userId), sk: PROFILE_SK }, ConsistentRead: true }),
        );
        return saved.Item ? { result: "updated" as const, member: itemToMember(saved.Item) } : { result: "missing" as const, member: null };
      } catch (caught) {
        const reasons = cancellationReasons(caught);
        if (!reasons.length) {
          throw caught;
        }
        const current = await client.send(
          new GetCommand({ TableName: tableName, Key: { pk: userKey(userId), sk: PROFILE_SK }, ConsistentRead: true }),
        );
        const member = current.Item ? itemToMember(current.Item) : null;
        const phoneFailed = phoneIndex >= 0 && reasons[phoneIndex] === "ConditionalCheckFailed";
        if (phoneFailed) {
          let owner: string | null = null;
          if (phoneForIndex) {
            const index = await client.send(
              new GetCommand({
                TableName: tableName,
                Key: { pk: phoneKey(phoneForIndex), sk: UNIQUE_SK },
                ConsistentRead: true,
              }),
            );
            owner = typeof index.Item?.userId === "string" ? index.Item.userId : null;
          }
          if (owner !== userId) {
            return { result: "phone-taken" as const, member };
          }
        }
        const transient = reasons.some((reason) => reason === "TransactionConflict");
        const conditional = reasons.some((reason) => reason === "ConditionalCheckFailed");
        if (transient && !conditional) {
          return { result: "transient" as const, member };
        }
        if (!member) {
          return { result: "missing" as const, member: null };
        }
        return { result: "conflict" as const, member };
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
        const response = await client.send(
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
    async setTransactionPassword(userId, hash, updatedAt) {
      try {
        const response = await client.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { pk: userKey(userId), sk: PROFILE_SK },
            UpdateExpression: "SET #transactionPasswordHash = :transactionPasswordHash, #updatedAt = :updatedAt",
            ExpressionAttributeNames: {
              "#transactionPasswordHash": "transactionPasswordHash",
              "#updatedAt": "updatedAt",
            },
            ExpressionAttributeValues: {
              ":transactionPasswordHash": hash,
              ":updatedAt": updatedAt,
            },
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
    async setProfilePhoto(userId, profilePhotoKeyValue, updatedAt) {
      try {
        const response = await client.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { pk: userKey(userId), sk: PROFILE_SK },
            UpdateExpression: "SET #profilePhotoKey = :profilePhotoKey, #updatedAt = :updatedAt",
            ExpressionAttributeNames: {
              "#profilePhotoKey": "profilePhotoKey",
              "#updatedAt": "updatedAt",
            },
            ExpressionAttributeValues: {
              ":profilePhotoKey": profilePhotoKeyValue,
              ":updatedAt": updatedAt,
            },
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
    if (reasons[3] === "ConditionalCheckFailed") {
      return "phone-taken";
    }
    if (reasons[2] === "ConditionalCheckFailed" || reasons[2] === "TransactionConflict") {
      return "email-taken";
    }
    if (reasons[3] === "TransactionConflict") {
      return "phone-taken";
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

async function listAdminIdentifiers(userPoolId: string): Promise<string[]> {
  const identifiers: string[] = [];
  let next: string | undefined;
  do {
    const response = await cognito.send(
      new ListUsersInGroupCommand({
        UserPoolId: userPoolId,
        GroupName: "Admins",
        Limit: 60,
        NextToken: next,
      }),
    );
    for (const user of response.Users ?? []) {
      if (user.Username) {
        identifiers.push(user.Username);
      }
      for (const attribute of user.Attributes ?? []) {
        if ((attribute.Name === "sub" || attribute.Name === "email") && attribute.Value) {
          identifiers.push(attribute.Name === "email" ? attribute.Value.toLowerCase() : attribute.Value);
        }
      }
    }
    next = response.NextToken;
  } while (next && identifiers.length < 300);
  return identifiers;
}

function referralKey(code: string): string {
  return `REFERRAL#${code}`;
}

function emailKey(email: string): string {
  return `EMAIL#${email.trim().toLowerCase()}`;
}

function phoneKey(phone: string | null): string {
  return `PHONE#${registrationPhoneKey(phone)}`;
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
    firstName: optionalString(item.firstName),
    lastName: optionalString(item.lastName),
    phone: optionalString(item.phone),
    country: optionalString(item.country),
    referralCode: requiredString(item.referralCode),
    sponsorUserId: optionalString(item.sponsorUserId),
    sponsorReferralCode: optionalString(item.sponsorReferralCode),
    transactionPasswordHash: optionalString(item.transactionPasswordHash),
    profilePhotoKey: storedPhotoKey(item),
    createdAt: requiredString(item.createdAt),
    updatedAt: requiredString(item.updatedAt),
    status: "active",
  };
}

function storedPhotoKey(item: Record<string, unknown>): string | null {
  const userId = typeof item.userId === "string" ? item.userId : "";
  const key = item.profilePhotoKey;
  if (typeof key !== "string" || !key) {
    return null;
  }
  try {
    return key === profilePhotoKey(userId) ? key : null;
  } catch {
    return null;
  }
}

function createProfilePhotoStore(bucket: string): ProfilePhotoStore {
  return {
    async put(input) {
      const key = profilePhotoKey(input.userId);
      try {
        await photos.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: input.bytes,
            ContentType: input.contentType,
            ServerSideEncryption: "AES256",
          }),
        );
      } catch {
        throw new MemberRequestError(500, "photo_failed", "Could not save that profile photo.");
      }
      return key;
    },
    async get(input) {
      const key = profilePhotoKey(input.userId);
      try {
        const response = await photos.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const bytes = await response.Body?.transformToByteArray();
        const contentType = response.ContentType;
        if (!bytes || (contentType !== "image/jpeg" && contentType !== "image/png" && contentType !== "image/webp")) {
          return null;
        }
        return { bytes, contentType };
      } catch (caught) {
        if (isMissingObject(caught)) {
          return null;
        }
        throw caught;
      }
    },
  };
}

function isMissingObject(caught: unknown): boolean {
  const name = caught && typeof caught === "object" ? (caught as { name?: string }).name : "";
  return name === "NoSuchKey" || name === "NotFound";
}

function requiredString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}
