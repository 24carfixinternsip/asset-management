export const TX_STATUS = {
  PENDING: "Pending",
  ACTIVE: "Active",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
} as const;

export type TransactionStatus = (typeof TX_STATUS)[keyof typeof TX_STATUS];

const TRANSACTION_STATUS_VALUES = Object.values(TX_STATUS) as TransactionStatus[];
const STATUS_VALUE_SET = new Set<string>(TRANSACTION_STATUS_VALUES);

export const isTransactionStatus = (value: unknown): value is TransactionStatus =>
  typeof value === "string" && STATUS_VALUE_SET.has(value);

export const normalizeTransactionStatus = (value?: string | null): TransactionStatus | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();

  if (
    normalized === "pending" ||
    normalized === "pendingapproval" ||
    normalized === "pending_approval" ||
    normalized === "รออนุมัติ"
  ) {
    return TX_STATUS.PENDING;
  }

  if (
    normalized === "active" ||
    normalized === "approved" ||
    normalized === "กำลังยืม" ||
    normalized === "อนุมัติแล้ว"
  ) {
    return TX_STATUS.ACTIVE;
  }

  if (normalized === "rejected" || normalized === "ปฏิเสธ" || normalized === "ถูกปฏิเสธ") {
    return TX_STATUS.REJECTED;
  }

  if (normalized === "completed" || normalized === "คืนแล้ว") {
    return TX_STATUS.COMPLETED;
  }

  if (normalized === "returned") {
    return TX_STATUS.RETURNED;
  }

  if (normalized === "cancelled" || normalized === "canceled" || normalized === "ยกเลิก") {
    return TX_STATUS.CANCELLED;
  }

  return null;
};

export const isReturnedLikeStatus = (status?: string | null) => {
  const normalized = normalizeTransactionStatus(status);
  return normalized === TX_STATUS.COMPLETED || normalized === TX_STATUS.RETURNED;
};

export const TX_STATUS_LABEL_TH: Record<TransactionStatus, string> = {
  [TX_STATUS.PENDING]: "รออนุมัติ",
  [TX_STATUS.ACTIVE]: "กำลังยืม",
  [TX_STATUS.REJECTED]: "ปฏิเสธ",
  [TX_STATUS.COMPLETED]: "คืนแล้ว",
  [TX_STATUS.RETURNED]: "คืนแล้ว",
  [TX_STATUS.CANCELLED]: "ยกเลิก",
};

export const getTransactionStatusLabelTH = (value?: string | null) => {
  const status = normalizeTransactionStatus(value);
  if (!status) return value?.trim() || "ไม่ทราบสถานะ";
  return TX_STATUS_LABEL_TH[status];
};
