import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  TX_STATUS,
  type TransactionStatus,
} from "@/constants/transactionStatus";
import { supabase } from "@/integrations/supabase/client";
import {
  RETURN_GENERIC_ERROR_MESSAGE,
  RETURN_SUCCESS_MESSAGE,
  toFriendlyReturnErrorMessage,
} from "@/lib/return-flow";

interface RpcResponse {
  success: boolean;
  message: string;
}

export interface Transaction {
  id: string;
  employee_id: string | null;
  department_id: string | null;
  serial_id: string;
  borrow_date: string;
  return_date: string | null;
  status: TransactionStatus;
  note: string | null;
  created_at: string;
  employees?: {
    name: string;
    emp_code: string;
    department_id: string | null;
  } | null;
  departments?: {
    name: string;
  } | null;
  product_serials?: {
    serial_code: string;
    products?: {
      name: string;
      p_id: string;
      image_url: string | null;
      brand: string | null;
      model: string | null;
    };
  };
}

export interface CreateTransactionInput {
  serial_id: string;
  employee_id?: string | null;
  department_id?: string | null;
  note?: string | null;
}

export interface ReturnTransactionInput {
  transactionId: string;
  serialId?: string;
  condition: string;
  note?: string;
}

export interface ApproveRequestInput {
  transactionId: string;
}

export interface RejectRequestInput {
  transactionId: string;
  reason: string;
}

export function useTransactions(status?: TransactionStatus, page = 1, pageSize = 8) {
  return useQuery({
    queryKey: ["transactions", status, page],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("transactions")
        .select(
          `
          *,
          employees (name, emp_code, department_id),
          departments (name),
          product_serials (
            serial_code,
            products (name, p_id, image_url, brand, model)
          )
        `,
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (status) {
        if (status === TX_STATUS.COMPLETED || status === TX_STATUS.RETURNED) {
          query = query.in("status", [TX_STATUS.COMPLETED, TX_STATUS.RETURNED]);
        } else {
          query = query.eq("status", status);
        }
      }

      const { data, count, error } = await query;
      if (error) throw error;

      return {
        data: data as unknown as Transaction[],
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    },
    placeholderData: (previousData) => previousData,
  });
}

export function useRecentTransactions(limit = 5) {
  return useQuery({
    queryKey: ["transactions", "recent", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          *,
          employees (name, emp_code, department_id),
          departments (name),
          product_serials (
            serial_code,
            products (name, p_id, image_url, brand, model)
          )
        `,
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as unknown as Transaction[];
    },
  });
}

export function useEmployeeTransactions(employeeId: string | null) {
  return useQuery({
    queryKey: ["transactions", "employee", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];

      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          *,
          product_serials (
            serial_code,
            products (name, p_id, image_url, brand, model)
          )
        `,
        )
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as Transaction[];
    },
    enabled: !!employeeId,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTransactionInput) => {
      const borrowerType = input.employee_id ? "employee" : "department";
      const borrowerId = input.employee_id || input.department_id;

      if (!borrowerId) {
        throw new Error("Missing borrower id");
      }

      const { data, error } = await supabase.rpc("borrow_item", {
        arg_serial_id: input.serial_id,
        arg_borrower_id: borrowerId,
        arg_borrower_type: borrowerType,
        arg_note: input.note || "",
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      if (!result.success) {
        throw new Error(result.message);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["serials"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: Error) => {
      console.error("Create transaction error:", error);
    },
  });
}

export function useReturnTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReturnTransactionInput) => {
      const { data, error } = await supabase.rpc("return_item", {
        arg_transaction_id: input.transactionId,
        arg_return_condition: input.condition,
        arg_note: input.note || "",
      });

      if (error) throw error;
      const result = data as unknown as RpcResponse;

      if (result && result.success === false) {
        throw new Error(result.message);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["serials"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("à¸£à¸±à¸šà¸„à¸·à¸™à¸ªà¸´à¸™à¸„à¹‰à¸²à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢à¹à¸¥à¹‰à¸§");
    },
    onError: (error: Error) => {
      toast.error(`à¸£à¸±à¸šà¸„à¸·à¸™à¸ªà¸´à¸™à¸„à¹‰à¸²à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: ${error.message}`);
    },
  });
}

export function useMyHistory(page = 1, pageSize = 10) {
  return useQuery({
    queryKey: ["my-transactions", page, pageSize],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.email) {
        return { data: [], total: 0, totalPages: 0 };
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const query = supabase
        .from("transactions")
        .select(
          `
          *,
          employees!inner(name, email),
          product_serials (
            serial_code,
            products (name, image_url, brand, model)
          )
        `,
          { count: "exact" },
        )
        .eq("employees.email", session.user.email)
        .order("created_at", { ascending: false })
        .range(from, to);

      const { data, count, error } = await query;

      if (error) {
        console.error("Error fetching my history:", error);
        throw error;
      }

      return {
        data: data as unknown as any[],
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    },
    placeholderData: (previousData) => previousData,
  });
}

export function useApproveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ApproveRequestInput) => {
      const { data, error } = await supabase.rpc("approve_borrow_request", {
        arg_transaction_id: input.transactionId,
      });

      if (error) throw error;
      const result = data as { success: boolean; message: string };

      if (!result.success) {
        throw new Error(result.message);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["serials"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¸„à¸³à¸‚à¸­à¸ªà¸³à¹€à¸£à¹‡à¸ˆ");
    },
    onError: (error: Error) => {
      toast.error(`à¸­à¸™à¸¸à¸¡à¸±à¸•à¸´à¸„à¸³à¸‚à¸­à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: ${error.message}`);
    },
  });
}

export function useRejectRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RejectRequestInput) => {
      const { data, error } = await supabase.rpc("reject_borrow_request", {
        arg_transaction_id: input.transactionId,
        arg_reason: input.reason,
      });

      if (error) throw error;
      const result = data as { success: boolean; message: string };

      if (!result.success) {
        throw new Error(result.message);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["serials"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("à¸›à¸à¸´à¹€à¸ªà¸˜à¸„à¸³à¸‚à¸­à¹€à¸£à¸µà¸¢à¸šà¸£à¹‰à¸­à¸¢à¹à¸¥à¹‰à¸§");
    },
    onError: (error: Error) => {
      toast.error(`à¸›à¸à¸´à¹€à¸ªà¸˜à¸„à¸³à¸‚à¸­à¹„à¸¡à¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ: ${error.message}`);
    },
  });
}

export interface RequestReturnInput {
  serialId: string;
  returnNote: string;
  clientRequestId?: string;
}

const RETURN_NOTE_MAX_LENGTH = 500;
const RETURN_IN_FLIGHT = new Set<string>();

const createClientRequestId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

type ReturnTransactionMutationResult = {
  id: string;
  status: string;
  requestId: string;
  replayed?: boolean;
};

type ReturnTransactionApiResponse = {
  success?: boolean;
  message?: string;
  code?: string;
  transaction?: {
    id?: string;
    status?: string;
  } | null;
};

const toReturnApiResponse = (payload: unknown): ReturnTransactionApiResponse =>
  payload && typeof payload === "object" ? (payload as ReturnTransactionApiResponse) : {};

export function useRequestReturn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RequestReturnInput) => {
      const serialId = input.serialId.trim();
      const lockKey = serialId;
      const requestId = input.clientRequestId ?? createClientRequestId();

      if (!serialId) {
        throw new Error("ข้อมูลสินค้าไม่ถูกต้อง");
      }

      if (RETURN_IN_FLIGHT.has(lockKey)) {
        return {
          id: serialId,
          status: TX_STATUS.COMPLETED,
          requestId,
          replayed: true,
        } satisfies ReturnTransactionMutationResult;
      }

      RETURN_IN_FLIGHT.add(lockKey);
      const returnNote = input.returnNote.trim().slice(0, RETURN_NOTE_MAX_LENGTH);

      try {
        const { data, error } = await supabase.functions.invoke("return-transaction", {
          body: {
            serialId,
            note: returnNote || undefined,
          },
          headers: {
            "Idempotency-Key": requestId,
          },
        });

        if (error) {
          const friendlyError = await toFriendlyReturnErrorMessage(error);
          throw new Error(friendlyError);
        }

        const result = toReturnApiResponse(data);
        if (result.success === false) {
          const friendlyError = await toFriendlyReturnErrorMessage(result);
          throw new Error(friendlyError);
        }

        const transactionId = result.transaction?.id ?? serialId;
        const status = result.transaction?.status ?? TX_STATUS.COMPLETED;

        return {
          id: transactionId,
          status,
          requestId,
          replayed: false,
        } satisfies ReturnTransactionMutationResult;
      } finally {
        RETURN_IN_FLIGHT.delete(lockKey);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["serials"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(RETURN_SUCCESS_MESSAGE);
    },
    onError: (error: Error) => {
      console.error("[ReturnFlow] request return failed", error);
      toast.error(error.message || RETURN_GENERIC_ERROR_MESSAGE);
    },
  });
}
