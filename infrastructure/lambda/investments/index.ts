import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  ListUsersInGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { AdminGroupDirectory } from "../../../lib/admin/groups";
import {
  handleInvestmentApi,
  investmentFromStoredItem,
  postMonthlyCommissions,
  postMonthlyProfits,
  previousUtcMonth,
  profitFromStoredItem,
  withdrawalFromStoredItem,
  commissionFromStoredItem,
  type CreateInvestmentResult,
  type DepositReview,
  type DepositReviewResult,
  type DepositSubmission,
  type DepositSubmissionResult,
  type InvestmentActivation,
  type InvestmentActivationResult,
  type InvestmentRecord,
  type InvestmentStore,
  type ProfitEntry,
  type CommissionEntry,
  type WithdrawalRequest,
} from "../../../lib/investments/service";

const INVESTMENT_PREFIX = "INVESTMENT#";
const IDEMPOTENCY_PREFIX = "IDEMPOTENCY#";
const DEPOSIT_IDEMPOTENCY_PREFIX = "IDEMPOTENCY#DEPOSIT#";
const MAX_SCAN_ITEMS = 200;
const SCAN_PAGE_LIMIT = 50;
const MAX_PROFIT_SCAN_ITEMS = 500;
const PROFIT_PREFIX = "PROFIT#";
const COMMISSION_PREFIX = "COMMISSION#";
const WITHDRAWAL_PREFIX = "WITHDRAWAL#";
const MEMBER_PROFILE_SK = "PROFILE";

type ApiGatewayEvent = {
  source?: string;
  time?: string;
  rawPath?: string;
  body?: string | null;
  headers?: Record<string, string | undefined>;
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
const proofStorage = new S3Client({});

export async function handler(event: ApiGatewayEvent): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> {
  const tableName = process.env.INVESTMENTS_TABLE_NAME;
  const membersTableName = process.env.MEMBERS_TABLE_NAME;
  if (!tableName || !membersTableName) {
    return json(500, { error: "configuration", message: "Investment storage is not configured." });
  }

  if (event.source === "aws.events") {
    const postedAt = typeof event.time === "string" ? event.time : new Date().toISOString();
    const period = previousUtcMonth(postedAt);
    const store = createDynamoInvestmentStore(tableName);
    const sponsors = { sponsorOf: (userId: string) => sponsorOf(membersTableName, userId) };
    const profits = await postMonthlyProfits({ store, period, postedAt });
    const commissions = await postMonthlyCommissions({ store, sponsors, period, postedAt });
    return json(200, { profits, commissions });
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

  const result = await handleInvestmentApi({
    method: event.requestContext?.http?.method ?? "GET",
    path: event.rawPath ?? "/",
    claims: event.requestContext?.authorizer?.jwt?.claims,
    body,
    idempotencyKey: headerValue(event.headers, "idempotency-key"),
    store: createDynamoInvestmentStore(tableName),
    proofStore: process.env.DEPOSIT_PROOF_BUCKET ? createProofStore(process.env.DEPOSIT_PROOF_BUCKET) : undefined,
    adminGroups: process.env.USER_POOL_ID ? createAdminDirectory(process.env.USER_POOL_ID) : undefined,
  });

  return json(result.statusCode, result.body);
}

function createProofStore(bucket: string) {
  return {
    async put(input: { ownerSub: string; investmentId: string; proof: { bytes: Uint8Array; contentType: string } }) {
      const key = `deposit-proofs/${input.ownerSub}/${input.investmentId}/${crypto.randomUUID()}`;
      await proofStorage.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: input.proof.bytes,
          ContentType: input.proof.contentType,
          ServerSideEncryption: "AES256",
        }),
      );
      return key;
    },
  };
}

function createAdminDirectory(userPoolId: string): AdminGroupDirectory {
  return {
    async findByEmail(email) {
      const response = await cognito.send(
        new ListUsersCommand({
          UserPoolId: userPoolId,
          Filter: `email = "${email.replaceAll('"', "")}"`,
          Limit: 2,
        }),
      );
      const user = response.Users?.[0];
      if (!user?.Username) {
        return null;
      }
      const found = user.Attributes?.find((attribute) => attribute.Name === "email")?.Value ?? email;
      return { username: user.Username, email: found };
    },
    async groupsFor(username) {
      const response = await cognito.send(
        new AdminListGroupsForUserCommand({
          UserPoolId: userPoolId,
          Username: username,
        }),
      );
      return (response.Groups ?? []).flatMap((group) => (group.GroupName ? [group.GroupName] : []));
    },
    async listAdminUsernames() {
      const names: string[] = [];
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
            names.push(user.Username);
          }
        }
        next = response.NextToken;
      } while (next && names.length < 300);
      return names;
    },
    async grant(username) {
      await cognito.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: userPoolId,
          Username: username,
          GroupName: "Admins",
        }),
      );
    },
    async remove(username) {
      await cognito.send(
        new AdminRemoveUserFromGroupCommand({
          UserPoolId: userPoolId,
          Username: username,
          GroupName: "Admins",
        }),
      );
    },
    async signOut(username) {
      await cognito.send(
        new AdminUserGlobalSignOutCommand({
          UserPoolId: userPoolId,
          Username: username,
        }),
      );
    },
  };
}

function json(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function headerValue(headers: Record<string, string | undefined> | undefined, name: string): string | undefined {
  if (!headers) {
    return undefined;
  }
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return found?.[1];
}

export function createDynamoInvestmentStore(tableName: string): InvestmentStore {
  return {
    async create(record, idempotencyKey) {
      try {
        await document.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: tableName,
                  Item: investmentToItem(record),
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
              {
                Put: {
                  TableName: tableName,
                  Item: {
                    pk: userKey(record.ownerSub),
                    sk: `${IDEMPOTENCY_PREFIX}${idempotencyKey}`,
                    investmentId: record.investmentId,
                  },
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
            ],
          }),
        );
        return { result: "created" };
      } catch (caught) {
        return cancellationResult(caught, tableName, record.ownerSub, idempotencyKey);
      }
    },
    async submitDeposit(submission) {
      try {
        await document.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Update: {
                  TableName: tableName,
                  Key: { pk: userKey(submission.ownerSub), sk: `${INVESTMENT_PREFIX}${submission.investmentId}` },
                  UpdateExpression:
                    "SET #status = :pending, depositReference = :reference, submittedAt = :submittedAt, updatedAt = :submittedAt, statusChangedAt = :submittedAt" +
                    (submission.depositProofKey ? ", depositProofKey = :proofKey" : ""),
                  ConditionExpression: "#status = :awaiting AND ownerSub = :owner",
                  ExpressionAttributeNames: { "#status": "status" },
                  ExpressionAttributeValues: {
                    ":pending": "pending_verification",
                    ":awaiting": "awaiting_deposit",
                    ":reference": submission.depositReference,
                    ":submittedAt": submission.submittedAt,
                    ":owner": submission.ownerSub,
                    ...(submission.depositProofKey ? { ":proofKey": submission.depositProofKey } : {}),
                  },
                },
              },
              {
                Put: {
                  TableName: tableName,
                  Item: {
                    pk: userKey(submission.ownerSub),
                    sk: `${DEPOSIT_IDEMPOTENCY_PREFIX}${submission.idempotencyKey}`,
                    investmentId: submission.investmentId,
                  },
                  ConditionExpression: "attribute_not_exists(pk)",
                },
              },
            ],
          }),
        );
        return { result: "submitted" };
      } catch (caught) {
        return depositCancellation(caught, tableName, submission);
      }
    },
    async listPendingDeposits() {
      const items = await scanMatches(tableName, {
        FilterExpression: "#status = :pending AND begins_with(sk, :prefix)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":pending": "pending_verification", ":prefix": INVESTMENT_PREFIX },
      });
      return items
        .map((item) => itemToInvestment(item))
        .sort(
          (left, right) =>
            (right.submittedAt ?? right.createdAt).localeCompare(left.submittedAt ?? left.createdAt) ||
            left.investmentId.localeCompare(right.investmentId),
        );
    },
    async listVerifiedDeposits() {
      const items = await scanMatches(tableName, {
        FilterExpression: "#status = :verified AND begins_with(sk, :prefix)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":verified": "deposit_verified", ":prefix": INVESTMENT_PREFIX },
      });
      return items
        .map((item) => itemToInvestment(item))
        .sort(
          (left, right) =>
            (right.reviewedAt ?? right.createdAt).localeCompare(left.reviewedAt ?? left.createdAt) ||
            left.investmentId.localeCompare(right.investmentId),
        );
    },
    async reviewDeposit(review) {
      return reviewStoredDeposit(tableName, review);
    },
    async activateInvestment(activation) {
      return activateStoredInvestment(tableName, activation);
    },
    async listActiveInvestments() {
      return scanActiveInvestments(tableName);
    },
    async putProfit(entry) {
      try {
        await document.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              pk: userKey(entry.ownerSub),
              sk: `${PROFIT_PREFIX}${entry.investmentId}#${entry.period}`,
              ...entry,
            },
            ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
          }),
        );
        return "created";
      } catch (caught) {
        if (caught && typeof caught === "object" && (caught as { name?: string }).name === "ConditionalCheckFailedException") {
          return "duplicate";
        }
        throw caught;
      }
    },
    async listProfits(ownerSub) {
      const records: ProfitEntry[] = [];
      let startKey: Record<string, unknown> | undefined;
      do {
        const response = await document.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
            ExpressionAttributeValues: {
              ":pk": userKey(ownerSub),
              ":prefix": PROFIT_PREFIX,
            },
            ExclusiveStartKey: startKey,
          }),
        );
        for (const item of response.Items ?? []) {
          records.push(profitFromStoredItem(item));
        }
        startKey = response.LastEvaluatedKey;
      } while (startKey);
      return records.sort(
        (left, right) => right.period.localeCompare(left.period) || left.investmentId.localeCompare(right.investmentId),
      );
    },
    async putCommission(entry) {
      try {
        await document.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              pk: userKey(entry.recipientSub),
              sk: `${COMMISSION_PREFIX}${entry.investmentId}#${entry.period}#${entry.generation}`,
              ...entry,
            },
            ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
          }),
        );
        return "created";
      } catch (caught) {
        if (caught && typeof caught === "object" && (caught as { name?: string }).name === "ConditionalCheckFailedException") {
          return "duplicate";
        }
        throw caught;
      }
    },
    async listCommissions(recipientSub) {
      const records: CommissionEntry[] = [];
      let startKey: Record<string, unknown> | undefined;
      do {
        const response = await document.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
            ExpressionAttributeValues: {
              ":pk": userKey(recipientSub),
              ":prefix": COMMISSION_PREFIX,
            },
            ExclusiveStartKey: startKey,
          }),
        );
        for (const item of response.Items ?? []) {
          records.push(commissionFromStoredItem(item));
        }
        startKey = response.LastEvaluatedKey;
      } while (startKey);
      return records.sort(
        (left, right) =>
          right.period.localeCompare(left.period) ||
          left.generation - right.generation ||
          left.investmentId.localeCompare(right.investmentId),
      );
    },
    async putWithdrawal(request) {
      try {
        await document.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              pk: userKey(request.ownerSub),
              sk: `${WITHDRAWAL_PREFIX}${request.withdrawalId}`,
              ...request,
            },
            ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
          }),
        );
        return "created";
      } catch (caught) {
        if (caught && typeof caught === "object" && (caught as { name?: string }).name === "ConditionalCheckFailedException") {
          return "duplicate";
        }
        throw caught;
      }
    },
    async listWithdrawals(ownerSub) {
      const records: WithdrawalRequest[] = [];
      let startKey: Record<string, unknown> | undefined;
      do {
        const response = await document.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
            ExpressionAttributeValues: {
              ":pk": userKey(ownerSub),
              ":prefix": WITHDRAWAL_PREFIX,
            },
            ExclusiveStartKey: startKey,
          }),
        );
        for (const item of response.Items ?? []) {
          records.push(withdrawalFromStoredItem(item));
        }
        startKey = response.LastEvaluatedKey;
      } while (startKey);
      return records.sort(
        (left, right) => right.createdAt.localeCompare(left.createdAt) || left.withdrawalId.localeCompare(right.withdrawalId),
      );
    },
    async getById(ownerSub, investmentId) {
      const response = await document.send(
        new GetCommand({
          TableName: tableName,
          Key: { pk: userKey(ownerSub), sk: `${INVESTMENT_PREFIX}${investmentId}` },
        }),
      );
      return response.Item ? itemToInvestment(response.Item) : null;
    },
    async listByOwner(ownerSub) {
      const records: InvestmentRecord[] = [];
      let startKey: Record<string, unknown> | undefined;
      do {
        const response = await document.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
            ExpressionAttributeValues: {
              ":pk": userKey(ownerSub),
              ":prefix": INVESTMENT_PREFIX,
            },
            ExclusiveStartKey: startKey,
          }),
        );
        for (const item of response.Items ?? []) {
          records.push(itemToInvestment(item));
        }
        startKey = response.LastEvaluatedKey;
      } while (startKey);
      return records.sort(
        (left, right) => right.createdAt.localeCompare(left.createdAt) || left.investmentId.localeCompare(right.investmentId),
      );
    },
    async getDepositAddress() {
      const response = await document.send(
        new GetCommand({
          TableName: tableName,
          Key: { pk: "SETTINGS", sk: "DEPOSIT_ADDRESS" },
        }),
      );
      const item = response.Item;
      if (!item || typeof item.address !== "string") {
        return null;
      }
      return {
        address: item.address,
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
        updatedBy: typeof item.updatedBy === "string" ? item.updatedBy : "",
      };
    },
    async saveDepositAddress(record) {
      await document.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            pk: "SETTINGS",
            sk: "DEPOSIT_ADDRESS",
            address: record.address,
            updatedAt: record.updatedAt,
            updatedBy: record.updatedBy,
          },
        }),
      );
    },
  };
}

async function cancellationResult(
  caught: unknown,
  tableName: string,
  ownerSub: string,
  idempotencyKey: string,
): Promise<CreateInvestmentResult> {
  const reasons = cancellationReasons(caught);
  if (reasons[1] === "ConditionalCheckFailed") {
    const response = await document.send(
      new GetCommand({
        TableName: tableName,
        Key: { pk: userKey(ownerSub), sk: `${IDEMPOTENCY_PREFIX}${idempotencyKey}` },
      }),
    );
    const investmentId = response.Item?.investmentId;
    if (typeof investmentId === "string") {
      return { result: "exists", investmentId };
    }
  }
  if (reasons[0] === "ConditionalCheckFailed") {
    return { result: "id-taken" };
  }
  throw caught;
}

async function depositCancellation(
  caught: unknown,
  tableName: string,
  submission: DepositSubmission,
): Promise<DepositSubmissionResult> {
  const reasons = cancellationReasons(caught);
  if (reasons[1] === "ConditionalCheckFailed") {
    const response = await document.send(
      new GetCommand({
        TableName: tableName,
        Key: { pk: userKey(submission.ownerSub), sk: `${DEPOSIT_IDEMPOTENCY_PREFIX}${submission.idempotencyKey}` },
      }),
    );
    return response.Item?.investmentId === submission.investmentId ? { result: "exists" } : { result: "rejected" };
  }
  if (reasons[0] === "ConditionalCheckFailed") {
    const response = await document.send(
      new GetCommand({
        TableName: tableName,
        Key: { pk: userKey(submission.ownerSub), sk: `${INVESTMENT_PREFIX}${submission.investmentId}` },
      }),
    );
    return response.Item ? { result: "rejected" } : { result: "not-found" };
  }
  throw caught;
}

function cancellationReasons(caught: unknown): string[] {
  if (!caught || typeof caught !== "object") {
    return [];
  }
  const record = caught as { name?: string; CancellationReasons?: Array<{ Code?: string }> };
  if (record.name !== "TransactionCanceledException") {
    return [];
  }
  return (record.CancellationReasons ?? []).map((reason) => reason.Code ?? "");
}

async function reviewStoredDeposit(tableName: string, review: DepositReview): Promise<DepositReviewResult> {
  const items = await scanMatches(tableName, {
    FilterExpression: "sk = :sk AND #status = :pending",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: {
      ":sk": `${INVESTMENT_PREFIX}${review.investmentId}`,
      ":pending": "pending_verification",
    },
  });
  const item = items[0];
  if (!item || items.length !== 1) {
    return { result: "not-found" };
  }
  try {
    const response = await document.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { pk: item.pk, sk: item.sk },
        UpdateExpression:
          "SET #status = :decision, reviewedAt = :reviewedAt, reviewedBy = :reviewedBy, updatedAt = :reviewedAt, statusChangedAt = :reviewedAt",
        ConditionExpression: "#status = :pending",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":decision": review.decision,
          ":pending": "pending_verification",
          ":reviewedAt": review.reviewedAt,
          ":reviewedBy": review.reviewedBy,
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    if (!response.Attributes) {
      return { result: "not-found" };
    }
    return { result: "reviewed", record: itemToInvestment(response.Attributes) };
  } catch (caught) {
    if (caught && typeof caught === "object" && (caught as { name?: string }).name === "ConditionalCheckFailedException") {
      return { result: "rejected" };
    }
    throw caught;
  }
}

async function activateStoredInvestment(
  tableName: string,
  activation: InvestmentActivation,
): Promise<InvestmentActivationResult> {
  const items = await scanMatches(tableName, {
    FilterExpression: "sk = :sk",
    ExpressionAttributeNames: {},
    ExpressionAttributeValues: { ":sk": `${INVESTMENT_PREFIX}${activation.investmentId}` },
  });
  const item = items[0];
  if (!item || items.length !== 1) {
    return { result: "not-found" };
  }
  if (item.status !== "deposit_verified") {
    return { result: "rejected" };
  }
  try {
    const response = await document.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { pk: item.pk, sk: item.sk },
        UpdateExpression:
          "SET #status = :active, activatedAt = :activatedAt, activatedBy = :activatedBy, updatedAt = :activatedAt, statusChangedAt = :activatedAt",
        ConditionExpression: "#status = :verified",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":active": "active",
          ":verified": "deposit_verified",
          ":activatedAt": activation.activatedAt,
          ":activatedBy": activation.activatedBy,
        },
        ReturnValues: "ALL_NEW",
      }),
    );
    if (!response.Attributes) {
      return { result: "not-found" };
    }
    return { result: "activated", record: itemToInvestment(response.Attributes) };
  } catch (caught) {
    if (caught && typeof caught === "object" && (caught as { name?: string }).name === "ConditionalCheckFailedException") {
      return { result: "rejected" };
    }
    throw caught;
  }
}

async function scanActiveInvestments(tableName: string): Promise<InvestmentRecord[]> {
  const matches: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;
  let read = 0;
  do {
    const response = await document.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "#status = :active AND begins_with(sk, :prefix)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":active": "active", ":prefix": INVESTMENT_PREFIX },
        ExclusiveStartKey: startKey,
        Limit: SCAN_PAGE_LIMIT,
      }),
    );
    read += response.ScannedCount ?? 0;
    matches.push(...(response.Items ?? []));
    startKey = response.LastEvaluatedKey;
    if (startKey && read >= MAX_PROFIT_SCAN_ITEMS) {
      throw new Error("profit_scan_limit");
    }
  } while (startKey);
  return matches.map((item) => itemToInvestment(item));
}

async function scanMatches(
  tableName: string,
  query: {
    FilterExpression: string;
    ExpressionAttributeNames: Record<string, string>;
    ExpressionAttributeValues: Record<string, string>;
  },
): Promise<Record<string, unknown>[]> {
  const matches: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;
  let read = 0;
  do {
    const response = await document.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: query.FilterExpression,
        ...(Object.keys(query.ExpressionAttributeNames).length > 0
          ? { ExpressionAttributeNames: query.ExpressionAttributeNames }
          : {}),
        ExpressionAttributeValues: query.ExpressionAttributeValues,
        ExclusiveStartKey: startKey,
        Limit: SCAN_PAGE_LIMIT,
      }),
    );
    read += response.ScannedCount ?? 0;
    matches.push(...(response.Items ?? []));
    startKey = response.LastEvaluatedKey;
  } while (startKey && read < MAX_SCAN_ITEMS && matches.length < 50);
  return matches;
}

async function sponsorOf(membersTableName: string, userId: string): Promise<string | null> {
  const response = await document.send(
    new GetCommand({
      TableName: membersTableName,
      Key: { pk: userKey(userId), sk: MEMBER_PROFILE_SK },
      ProjectionExpression: "sponsorUserId",
    }),
  );
  const sponsorUserId = response.Item?.sponsorUserId;
  return typeof sponsorUserId === "string" && sponsorUserId.trim() ? sponsorUserId.trim() : null;
}

function userKey(userId: string): string {
  return `USER#${userId}`;
}

function investmentToItem(record: InvestmentRecord): Record<string, unknown> {
  return {
    pk: userKey(record.ownerSub),
    sk: `${INVESTMENT_PREFIX}${record.investmentId}`,
    ...record,
  };
}

function itemToInvestment(item: Record<string, unknown>): InvestmentRecord {
  return investmentFromStoredItem(item);
}
