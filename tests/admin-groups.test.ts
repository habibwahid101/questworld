import assert from "node:assert/strict";
import test from "node:test";
import { changeAdminGroup, type AdminGroupDirectory } from "../lib/admin/groups.ts";
import { readBinanceDepositAddress } from "../lib/deposits/address.ts";
import { adminSwitchTarget } from "../lib/auth/shell.ts";
import { handleInvestmentApi } from "../lib/investments/service.ts";
import { createMemoryInvestmentStore } from "../lib/investments/memory-store.ts";

function directory(seed: { username: string; email: string; admin: boolean }[]): AdminGroupDirectory & { removed: string[]; signedOut: string[] } {
  const users = seed.map((user) => ({ ...user }));
  const removed: string[] = [];
  const signedOut: string[] = [];
  return {
    removed,
    signedOut,
    async findByEmail(email) {
      const found = users.find((user) => user.email === email);
      return found ? { username: found.username, email: found.email } : null;
    },
    async groupsFor(username) {
      const found = users.find((user) => user.username === username);
      return found?.admin ? ["Admins"] : [];
    },
    async listAdminUsernames() {
      return users.filter((user) => user.admin).map((user) => user.username);
    },
    async grant(username) {
      const found = users.find((user) => user.username === username);
      if (found) {
        found.admin = true;
      }
    },
    async remove(username) {
      removed.push(username);
      const found = users.find((user) => user.username === username);
      if (found) {
        found.admin = false;
      }
    },
    async signOut(username) {
      signedOut.push(username);
    },
  };
}

test("an admin can grant and remove another member, but not the last admin", async () => {
  const groups = directory([
    { username: "admin-1", email: "admin@example.com", admin: true },
    { username: "admin-2", email: "second@example.com", admin: true },
    { username: "member-2", email: "member@example.com", admin: false },
  ]);
  const granted = await changeAdminGroup({
    actorSub: "admin-1",
    actorEmail: "admin@example.com",
    body: { email: "member@example.com", action: "grant" },
    directory: groups,
  });
  assert.equal(granted.result, "granted");
  assert.match(granted.message, /log in again/);
  assert.deepEqual(groups.signedOut, ["member-2"]);

  const removed = await changeAdminGroup({
    actorSub: "admin-1",
    actorEmail: "admin@example.com",
    body: { email: "member@example.com", action: "remove" },
    directory: groups,
  });
  assert.equal(removed.result, "removed");
  assert.deepEqual(groups.removed, ["member-2"]);
});

test("removing the last administrator is rejected and a member cannot call the route", async () => {
  const only = directory([{ username: "admin-2", email: "second@example.com", admin: true }]);
  await assert.rejects(
    () =>
      changeAdminGroup({
        actorSub: "admin-1",
        actorEmail: "admin@example.com",
        body: { email: "second@example.com", action: "remove" },
        directory: only,
      }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "last_admin",
  );
  assert.deepEqual(only.removed, []);

  const self = directory([
    { username: "admin-1", email: "admin@example.com", admin: true },
    { username: "admin-2", email: "second@example.com", admin: true },
  ]);
  await assert.rejects(
    () =>
      changeAdminGroup({
        actorSub: "admin-1",
        actorEmail: "admin@example.com",
        body: { email: "admin@example.com", action: "remove" },
        directory: self,
      }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "self_group_change",
  );

  const denied = await handleInvestmentApi({
    method: "POST",
    path: "/admin/members/group",
    claims: { sub: "member-1", email: "member@example.com" },
    body: { email: "second@example.com", action: "grant" },
    store: createMemoryInvestmentStore(),
    adminGroups: directory([{ username: "admin-2", email: "second@example.com", admin: true }]),
  });
  assert.equal(denied.statusCode, 403);
});

test("the admin switch is only a shell target", () => {
  assert.deepEqual(adminSwitchTarget("/dashboard"), { href: "/admin", label: "Admin view" });
  assert.deepEqual(adminSwitchTarget("/admin/deposits"), { href: "/dashboard", label: "Member view" });
});

test("an unconfigured Binance address is not invented", () => {
  assert.equal(readBinanceDepositAddress(undefined), "");
  assert.equal(readBinanceDepositAddress("  "), "");
  assert.equal(readBinanceDepositAddress("PASTE THE ADDRESS HERE"), "");
  assert.equal(readBinanceDepositAddress("TExampleAddress"), "");
});
