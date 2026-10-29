import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { checkReferralCode, type MemberStore } from "../lib/members/service.ts";

function store(owners: Record<string, string>) {
  const lookups: string[] = [];
  const fake: Pick<MemberStore, "getUserIdByReferralCode"> = {
    async getUserIdByReferralCode(code) {
      lookups.push(code);
      return owners[code] ?? null;
    },
  };
  return { fake, lookups };
}

test("referral check reports a known code as valid without the owner id", async () => {
  const { fake, lookups } = store({ ABCD1234: "user-secret-id" });
  const result = await checkReferralCode(fake, "  ABCD1234 ");
  assert.deepEqual(result, { valid: true, code: "ABCD1234" });
  assert.deepEqual(Object.keys(result).sort(), ["code", "valid"]);
  assert.doesNotMatch(JSON.stringify(result), /user-secret-id/);
  assert.deepEqual(lookups, ["ABCD1234"]);
});

test("referral check reports an unknown code as invalid", async () => {
  const { fake } = store({ ABCD1234: "user-1" });
  assert.deepEqual(await checkReferralCode(fake, "ZZZZ9999"), { valid: false, code: "ZZZZ9999" });
});

test("referral check rejects empty, missing, and malformed codes without a lookup", async () => {
  const { fake, lookups } = store({ ABCD1234: "user-1" });
  assert.deepEqual(await checkReferralCode(fake, ""), { valid: false, code: "" });
  assert.deepEqual(await checkReferralCode(fake, "   "), { valid: false, code: "" });
  assert.deepEqual(await checkReferralCode(fake, undefined), { valid: false, code: "" });
  assert.equal((await checkReferralCode(fake, "ab$%")).valid, false);
  assert.equal((await checkReferralCode(fake, "A")).valid, false);
  assert.deepEqual(lookups, []);
});

test("members lambda serves the public referral check before authenticated routing", () => {
  const source = readFileSync(new URL("../infrastructure/lambda/members/index.ts", import.meta.url), "utf8");
  assert.match(source, /\/members\/referral-check/);
  assert.match(source, /checkReferralCode\(createDynamoMemberStore\(tableName\), event\.queryStringParameters\?\.code\)/);
  assert.ok(source.indexOf("/members/referral-check") < source.indexOf("handleMemberApi({"));
});

test("api stack adds the referral route without an authorizer and throttles it", () => {
  const source = readFileSync(new URL("../infrastructure/lib/api-stack.ts", import.meta.url), "utf8");
  const start = source.indexOf('path: "/members/referral-check"');
  assert.ok(start > 0);
  const route = source.slice(start, source.indexOf("});", start));
  assert.doesNotMatch(route, /authorizer/);
  assert.match(source, /"GET \/members\/referral-check": \{ ThrottlingRateLimit: 5, ThrottlingBurstLimit: 10 \}/);
});

test("register form checks the referral code before creating the Cognito account", () => {
  const form = readFileSync(new URL("../components/auth/RegisterForm.tsx", import.meta.url), "utf8");
  const check = form.indexOf("await checkReferralCode(referral)");
  const register = form.indexOf("await registerAccount(");
  assert.ok(check > 0 && register > 0 && check < register);
  const between = form.slice(check, register);
  assert.match(between, /if \(!check\.valid\)[\s\S]*referralCode:[\s\S]*return;/);
  assert.match(between, /catch[\s\S]*referralCode: message[\s\S]*return;/);
  assert.match(form, /if \(referral\) \{/);
  assert.match(form, /error=\{errors\.referralCode\}/);
});
