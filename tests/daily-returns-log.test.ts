import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import test from "node:test";
import { dailyReturnsCompletion } from "../lib/investments/service.ts";

register("./resolve-ts-extension.mjs", import.meta.url);

test("daily returns completion log keeps the existing summary", () => {
  const record = dailyReturnsCompletion("2026-11-16T01:00:00Z", {
    posted: 2,
    duplicate: 1,
    skipped: 3,
    completed: 1,
  });
  assert.deepEqual(record, {
    event: "daily_returns_complete",
    postedAt: "2026-11-16T01:00:00Z",
    posted: 2,
    duplicate: 1,
    skipped: 3,
    completed: 1,
  });
  assert.equal(Object.keys(record).length, 6);
});

test("scheduled returns log the summary and API configuration errors stay HTTP 500", () => {
  const source = readFileSync(new URL("../infrastructure/lambda/investments/index.ts", import.meta.url), "utf8");
  const handler = source.slice(source.indexOf("export async function handler"), source.indexOf("function createProofStore"));
  const scheduledStart = handler.indexOf('if (event.source === "aws.events")');
  const firstConfig = handler.indexOf("if (!tableName || !membersTableName)", scheduledStart);
  const apiConfig = handler.indexOf("if (!tableName || !membersTableName)", firstConfig + 1);
  const scheduled = handler.slice(scheduledStart, apiConfig);
  assert.match(scheduled, /throw new Error\("Investment storage is not configured\."\)/);
  assert.match(scheduled, /console\.log\(JSON\.stringify\(dailyReturnsCompletion\(postedAt, returns\)\)\)/);
  assert.doesNotMatch(scheduled, /return json\(500/);
  const apiConfiguration = handler.slice(apiConfig);
  assert.match(apiConfiguration, /return json\(500, \{ error: "configuration", message: "Investment storage is not configured\." \}\)/);
});

test("a scheduled run throws when investment storage is not configured", async () => {
  const investments = process.env.INVESTMENTS_TABLE_NAME;
  const members = process.env.MEMBERS_TABLE_NAME;
  delete process.env.INVESTMENTS_TABLE_NAME;
  delete process.env.MEMBERS_TABLE_NAME;
  const original = console.log;
  const lines: unknown[] = [];
  console.log = (...args: unknown[]) => {
    lines.push(args);
  };
  try {
    const imported: unknown = await import("../infrastructure/lambda/investments/index.ts" as string);
    const handler = (imported as { handler: (event: { source: string; time: string }) => Promise<unknown> }).handler;
    await assert.rejects(() => handler({ source: "aws.events", time: "2026-11-16T01:00:00Z" }), {
      message: "Investment storage is not configured.",
    });
    assert.deepEqual(lines, []);
  } finally {
    console.log = original;
    restoreEnv("INVESTMENTS_TABLE_NAME", investments);
    restoreEnv("MEMBERS_TABLE_NAME", members);
  }
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
