import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  handleInvestmentApi,
  investmentFromStoredItem,
  type CreateInvestmentResult,
  type DepositReview,
  type DepositReviewResult,
  type DepositSubmission,
  type DepositSubmissionResult,
  type InvestmentActivation,
  type InvestmentActivationResult,
  type InvestmentRecord,
  type InvestmentStore,
} from "../../../lib/investments/service";

const INVESTMENT_PREFIX = "INVESTMENT#";
const IDEMPOTENCY_PREFIX = "IDEMPOTENCY#";
const DEPOSIT_IDEMPOTENCY_PREFIX = "IDEMPOTENCY#DEPOSIT#";
const MAX_SCAN_ITEMS = 200;
const SCAN_PAGE_LIMIT = 50;

type ApiGatewayEvent = {
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

export async function handler(event: ApiGatewayEvent): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> {
  const tableName = process.env.INVESTMENTS_TABLE_NAME;
  if (!tableName) {
    return json(500, { error: "configuration", message: "Investment storage is not configured." });
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
                    "SET #status = :pending, depositReference = :reference, submittedAt = :submittedAt, updatedAt = :submittedAt, statusChangedAt = :submittedAt",
                  ConditionExpression: "#status = :awaiting AND ownerSub = :owner",
                  ExpressionAttributeNames: { "#status": "status" },
                  ExpressionAttributeValues: {
                    ":pending": "pending_verification",
                    ":awaiting": "awaiting_deposit",
                    ":reference": submission.depositReference,
                    ":submittedAt": submission.submittedAt,
                    ":owner": submission.ownerSub,
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
