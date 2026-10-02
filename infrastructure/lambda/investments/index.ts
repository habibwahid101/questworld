import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import {
  handleInvestmentApi,
  investmentFromStoredItem,
  type CreateInvestmentResult,
  type InvestmentRecord,
  type InvestmentStore,
} from "../../../lib/investments/service";

const INVESTMENT_PREFIX = "INVESTMENT#";
const IDEMPOTENCY_PREFIX = "IDEMPOTENCY#";

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
