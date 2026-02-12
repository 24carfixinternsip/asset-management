import test from "node:test";
import assert from "node:assert/strict";

import {
  TX_STATUS,
  isReturnedLikeStatus,
  normalizeTransactionStatus,
} from "../../src/constants/transactionStatus.ts";

test("normalizeTransactionStatus maps canonical values", () => {
  assert.equal(normalizeTransactionStatus("Pending"), TX_STATUS.PENDING);
  assert.equal(normalizeTransactionStatus("Active"), TX_STATUS.ACTIVE);
  assert.equal(normalizeTransactionStatus("Rejected"), TX_STATUS.REJECTED);
  assert.equal(normalizeTransactionStatus("Completed"), TX_STATUS.COMPLETED);
  assert.equal(normalizeTransactionStatus("Returned"), TX_STATUS.RETURNED);
  assert.equal(normalizeTransactionStatus("Cancelled"), TX_STATUS.CANCELLED);
});

test("normalizeTransactionStatus accepts Thai aliases", () => {
  assert.equal(normalizeTransactionStatus("รออนุมัติ"), TX_STATUS.PENDING);
  assert.equal(normalizeTransactionStatus("กำลังยืม"), TX_STATUS.ACTIVE);
  assert.equal(normalizeTransactionStatus("ถูกปฏิเสธ"), TX_STATUS.REJECTED);
  assert.equal(normalizeTransactionStatus("คืนแล้ว"), TX_STATUS.COMPLETED);
  assert.equal(normalizeTransactionStatus("ยกเลิก"), TX_STATUS.CANCELLED);
});

test("isReturnedLikeStatus accepts Completed and Returned", () => {
  assert.equal(isReturnedLikeStatus("Completed"), true);
  assert.equal(isReturnedLikeStatus("Returned"), true);
  assert.equal(isReturnedLikeStatus("Active"), false);
});
