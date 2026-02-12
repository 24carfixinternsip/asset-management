import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ReturnRequestBody = {
  serialId?: string;
  note?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RETURN_NOTE_LENGTH = 500;
const ACTIVE_NOT_FOUND_MESSAGE = "ไม่พบรายการยืมที่กำลังใช้งาน";
const DEFAULT_RETURN_ERROR_MESSAGE = "คืนสินค้าไม่สำเร็จ กรุณาลองใหม่";

const createResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const toSafeNote = (rawNote: unknown) => {
  if (typeof rawNote !== "string") return null;
  const trimmed = rawNote.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_RETURN_NOTE_LENGTH);
};

const extractBearerToken = (headerValue: string | null) => {
  if (!headerValue) return null;
  const normalized = headerValue.trim();
  if (!normalized.toLowerCase().startsWith("bearer ")) return null;
  const token = normalized.slice(7).trim();
  return token || null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return createResponse(405, { success: false, message: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return createResponse(500, { success: false, message: "Missing Supabase configuration" });
  }

  const authToken = extractBearerToken(req.headers.get("Authorization"));
  if (!authToken) {
    return createResponse(401, { success: false, message: "ต้องเข้าสู่ระบบก่อนทำรายการ" });
  }

  let body: ReturnRequestBody;
  try {
    body = (await req.json()) as ReturnRequestBody;
  } catch {
    return createResponse(400, { success: false, message: "ข้อมูลคำขอไม่ถูกต้อง" });
  }

  const serialId = body.serialId?.trim() ?? "";
  if (!uuidRegex.test(serialId)) {
    return createResponse(400, {
      success: false,
      code: "INVALID_SERIAL_ID",
      message: "serialId ไม่ถูกต้อง",
    });
  }

  const note = toSafeNote(body.note);

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: authUser, error: authError } = await supabaseAdmin.auth.getUser(authToken);
  if (authError || !authUser?.user) {
    return createResponse(401, {
      success: false,
      code: "UNAUTHORIZED",
      message: "สิทธิ์การใช้งานหมดอายุ กรุณาเข้าสู่ระบบใหม่",
    });
  }

  const { data: openTransaction, error: openTransactionError } = await supabaseAdmin
    .from("transactions")
    .select("id, serial_id, note, created_at")
    .eq("serial_id", serialId)
    .eq("status", "Active")
    .is("return_date", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openTransactionError) {
    console.error("[return-transaction] find open transaction failed", openTransactionError);
    return createResponse(500, {
      success: false,
      code: "LOOKUP_FAILED",
      message: DEFAULT_RETURN_ERROR_MESSAGE,
    });
  }

  if (!openTransaction) {
    return createResponse(409, {
      success: false,
      code: "ACTIVE_TRANSACTION_NOT_FOUND",
      message: ACTIVE_NOT_FOUND_MESSAGE,
    });
  }

  const nowIso = new Date().toISOString();
  const { data: updatedTransaction, error: updateError } = await supabaseAdmin
    .from("transactions")
    .update({
      status: "Completed",
      return_date: nowIso,
      note: note ?? openTransaction.note ?? null,
      updated_at: nowIso,
    })
    .eq("id", openTransaction.id)
    .eq("status", "Active")
    .is("return_date", null)
    .select("*")
    .maybeSingle();

  if (updateError) {
    const normalized = (updateError.message ?? "").toLowerCase();

    if (
      normalized.includes("transactions_status_check") ||
      (normalized.includes("violates check constraint") && normalized.includes("transactions"))
    ) {
      return createResponse(422, {
        success: false,
        code: "INVALID_TRANSACTION_STATUS",
        message: "คืนสินค้าไม่สำเร็จ: สถานะรายการไม่ถูกต้อง",
      });
    }

    console.error("[return-transaction] update transaction failed", updateError);
    return createResponse(500, {
      success: false,
      code: "UPDATE_FAILED",
      message: DEFAULT_RETURN_ERROR_MESSAGE,
    });
  }

  if (!updatedTransaction) {
    return createResponse(409, {
      success: false,
      code: "ACTIVE_TRANSACTION_NOT_FOUND",
      message: ACTIVE_NOT_FOUND_MESSAGE,
    });
  }

  const { error: syncSerialError } = await supabaseAdmin
    .from("product_serials")
    .update({ status: "ready" })
    .eq("id", serialId)
    .neq("status", "ready");

  if (syncSerialError) {
    console.warn("[return-transaction] serial sync skipped", {
      serialId,
      message: syncSerialError.message,
      code: syncSerialError.code,
    });
  }

  return createResponse(200, {
    success: true,
    message: "คืนสินค้าเรียบร้อย",
    transaction: updatedTransaction,
  });
});
