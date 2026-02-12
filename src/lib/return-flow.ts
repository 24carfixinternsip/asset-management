const THAI_PATTERN = /[\u0E00-\u0E7F]/;
const MOJIBAKE_PATTERN = /(\?{3,}|�|Ã.|à¸|à¹|àº|à»)/;

export const RETURN_SUCCESS_MESSAGE = "คืนสินค้าเรียบร้อย";
export const RETURN_ACTIVE_NOT_FOUND_MESSAGE = "ไม่พบรายการยืมที่กำลังใช้งาน";
export const RETURN_GENERIC_ERROR_MESSAGE = "คืนสินค้าไม่สำเร็จ กรุณาลองใหม่";

const readText = async (response: Response) => {
  try {
    return await response.text();
  } catch {
    return "";
  }
};

const parseJson = async (response: Response): Promise<Record<string, unknown> | null> => {
  try {
    const payload = await response.clone().json();
    if (payload && typeof payload === "object") {
      return payload as Record<string, unknown>;
    }
  } catch {
    // ignore parse errors and fall back to text
  }

  const text = await readText(response);
  if (!text) return null;

  try {
    const payload = JSON.parse(text);
    if (payload && typeof payload === "object") {
      return payload as Record<string, unknown>;
    }
  } catch {
    // ignore invalid payload
  }

  return { message: text };
};

const extractErrorPayload = async (error: unknown): Promise<Record<string, unknown> | null> => {
  if (!error || typeof error !== "object") return null;

  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    return parseJson(context);
  }

  return null;
};

const isUnreadableMessage = (message: string) => {
  const normalized = message.trim();
  return !normalized || MOJIBAKE_PATTERN.test(normalized);
};

const getRawErrorMessage = (error: unknown) => {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "";
};

const mapKnownMessage = (message: string, code?: string) => {
  const normalized = message.trim().toLowerCase();
  const normalizedCode = code?.toLowerCase();

  if (normalizedCode === "active_transaction_not_found") {
    return RETURN_ACTIVE_NOT_FOUND_MESSAGE;
  }

  if (
    normalized.includes("ไม่พบรายการยืม") ||
    normalized.includes("active_transaction_not_found") ||
    normalized.includes("not found")
  ) {
    return RETURN_ACTIVE_NOT_FOUND_MESSAGE;
  }

  if (
    normalizedCode === "invalid_transaction_status" ||
    normalized.includes("transactions_status_check") ||
    normalized.includes("violates check constraint")
  ) {
    return "คืนสินค้าไม่สำเร็จ: สถานะรายการไม่ถูกต้อง";
  }

  if (normalizedCode === "invalid_serial_id" || normalized.includes("invalid_serial")) {
    return "ข้อมูลสินค้าไม่ถูกต้อง";
  }

  if (normalizedCode === "unauthorized" || normalized.includes("unauthorized") || normalized.includes("401")) {
    return "สิทธิ์การใช้งานหมดอายุ กรุณาเข้าสู่ระบบใหม่";
  }

  if (normalized.includes("failed to fetch") || normalized.includes("network")) {
    return "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่";
  }

  if (THAI_PATTERN.test(message) && !isUnreadableMessage(message)) {
    return message.trim();
  }

  return RETURN_GENERIC_ERROR_MESSAGE;
};

export const toFriendlyReturnErrorMessage = async (error: unknown) => {
  const payload = await extractErrorPayload(error);
  const payloadMessage = typeof payload?.message === "string" ? payload.message : "";
  const payloadCode = typeof payload?.code === "string" ? payload.code : undefined;

  const candidateMessage = payloadMessage || getRawErrorMessage(error);
  if (!candidateMessage || isUnreadableMessage(candidateMessage)) {
    return mapKnownMessage("", payloadCode);
  }

  return mapKnownMessage(candidateMessage, payloadCode);
};
