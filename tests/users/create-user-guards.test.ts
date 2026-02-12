import test from "node:test";
import assert from "node:assert/strict";

import {
  dedupeUsersByIdentity,
  releaseSubmitLock,
  tryAcquireSubmitLock,
} from "../../src/components/users/users-utils.ts";

const makeUser = (overrides = {}) => ({
  id: "",
  emp_code: null,
  name: "Test User",
  nickname: null,
  gender: null,
  email: null,
  tel: null,
  image_url: null,
  location: null,
  location_id: null,
  department_id: null,
  user_id: null,
  role: "employee",
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  departments: null,
  locations: null,
  ...overrides,
});

test("submit lock prevents double-submit until released", () => {
  const lockRef = { current: false };

  assert.equal(tryAcquireSubmitLock(lockRef, false), true);
  assert.equal(tryAcquireSubmitLock(lockRef, false), false);
  assert.equal(tryAcquireSubmitLock(lockRef, true), false);

  releaseSubmitLock(lockRef);

  assert.equal(tryAcquireSubmitLock(lockRef, false), true);
});

test("dedupeUsersByIdentity keeps one user for duplicate id and prefers newest update", () => {
  const oldRecord = makeUser({
    id: "emp-001",
    email: "tester@24carfix.com",
    name: "Old Name",
    updated_at: "2026-02-01T10:00:00.000Z",
  });

  const newRecord = makeUser({
    id: "emp-001",
    email: "tester@24carfix.com",
    name: "New Name",
    updated_at: "2026-02-02T10:00:00.000Z",
  });

  const result = dedupeUsersByIdentity([oldRecord, newRecord]);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "emp-001");
  assert.equal(result[0].name, "New Name");
});

test("dedupeUsersByIdentity prevents duplicate list items for same email fallback key", () => {
  const first = makeUser({
    id: "",
    email: "duplicate@24carfix.com",
    name: "Duplicate A",
    updated_at: "2026-02-01T09:00:00.000Z",
  });

  const second = makeUser({
    id: "",
    email: "DUPLICATE@24carfix.com",
    name: "Duplicate B",
    updated_at: "2026-02-02T09:00:00.000Z",
  });

  const result = dedupeUsersByIdentity([first, second]);

  assert.equal(result.length, 1);
  assert.equal(result[0].email, "DUPLICATE@24carfix.com");
  assert.equal(result[0].name, "Duplicate B");
});
