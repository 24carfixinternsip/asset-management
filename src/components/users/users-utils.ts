import type { FormMode, Role, UserAccount, UserFormValues, UserStatus } from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  employee: "Employee",
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  pending: "Pending",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HAS_LETTER_REGEX = /[A-Za-z]/;
const HAS_NUMBER_REGEX = /\d/;
const HAS_SPECIAL_REGEX = /[^A-Za-z0-9]/;

export const normalizeRole = (role?: string | null): Role => (role === "admin" ? "admin" : "employee");

export const normalizeStatus = (status?: string | null): UserStatus => {
  if (status === "inactive") return "inactive";
  if (status === "pending") return "pending";
  return "active";
};

export const createDefaultUserFormValues = (): UserFormValues => ({
  name: "",
  email: "",
  tel: "",
  department_id: "",
  role: "employee",
  status: "active",
  setupMode: "invite",
  password: "",
  confirmPassword: "",
});

export const createUserFormValuesFromUser = (user: UserAccount): UserFormValues => ({
  name: user.name ?? "",
  email: user.email ?? "",
  tel: user.tel ?? "",
  department_id: user.department_id ?? "",
  role: normalizeRole(user.role),
  status: normalizeStatus(user.status) === "inactive" ? "inactive" : "active",
  setupMode: "invite",
  password: "",
  confirmPassword: "",
});

export type UserFormErrors = Partial<Record<keyof UserFormValues, string>>;

export const validateUserForm = (values: UserFormValues, mode: FormMode): UserFormErrors => {
  if (mode === "view") return {};

  const errors: UserFormErrors = {};
  const trimmedName = values.name.trim();
  const trimmedEmail = values.email.trim();
  const trimmedPassword = values.password.trim();
  const trimmedConfirmPassword = values.confirmPassword.trim();

  if (!trimmedName) {
    errors.name = "Please enter full name";
  }

  if (mode === "create") {
    if (!trimmedEmail) {
      errors.email = "Please enter email";
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = "Email format is invalid";
    }
  }

  if (!values.department_id) {
    errors.department_id = "Please select department";
  }

  if (mode === "create" && values.setupMode === "password") {
    if (!trimmedPassword) {
      errors.password = "Please enter initial password";
    } else if (trimmedPassword.length < 8 || !HAS_LETTER_REGEX.test(trimmedPassword) || !HAS_NUMBER_REGEX.test(trimmedPassword)) {
      errors.password = "Password must be at least 8 characters and contain letters and numbers";
    }

    if (!trimmedConfirmPassword) {
      errors.confirmPassword = "Please confirm password";
    } else if (trimmedPassword !== trimmedConfirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }
  }

  return errors;
};

export const generateTempPassword = () => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%*";
  const all = `${upper}${lower}${numbers}${symbols}`;

  const seed = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];

  while (seed.length < 14) {
    seed.push(all[Math.floor(Math.random() * all.length)]);
  }

  for (let index = seed.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const temp = seed[index];
    seed[index] = seed[randomIndex];
    seed[randomIndex] = temp;
  }

  return seed.join("");
};

export interface PasswordStrengthResult {
  label: string;
  toneClass: string;
  checks: Array<{ id: string; label: string; passed: boolean }>;
}

export const getPasswordStrength = (password: string): PasswordStrengthResult => {
  const value = password.trim();
  const checks = [
    { id: "len", label: "At least 8 characters", passed: value.length >= 8 },
    { id: "letter", label: "Contains alphabetic letters", passed: HAS_LETTER_REGEX.test(value) },
    { id: "number", label: "Contains numbers", passed: HAS_NUMBER_REGEX.test(value) },
    { id: "special", label: "Contains special characters (recommended)", passed: HAS_SPECIAL_REGEX.test(value) },
  ];
  const score = checks.filter((item) => item.passed).length;

  if (score <= 1) {
    return { label: "Weak", toneClass: "text-rose-600", checks };
  }
  if (score <= 2) {
    return { label: "Fair", toneClass: "text-amber-600", checks };
  }
  if (score <= 3) {
    return { label: "Good", toneClass: "text-emerald-600", checks };
  }
  return { label: "Strong", toneClass: "text-emerald-700", checks };
};

export const toSearchableUserText = (user: UserAccount) =>
  [
    user.name,
    user.nickname,
    user.emp_code,
    user.email,
    user.tel,
    user.departments?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export const sortUsersByName = (users: UserAccount[]) =>
  [...users].sort((left, right) => left.name.localeCompare(right.name, "th"));

export const normalizeEmailKey = (email?: string | null) => (email ?? "").trim().toLowerCase();

const toComparableTime = (value?: string | null) => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
};

function pickPreferredUser(current: UserAccount, incoming: UserAccount): UserAccount {
  const currentTime = Math.max(toComparableTime(current.updated_at), toComparableTime(current.created_at));
  const incomingTime = Math.max(toComparableTime(incoming.updated_at), toComparableTime(incoming.created_at));

  if (incomingTime >= currentTime) {
    return { ...current, ...incoming };
  }

  return { ...incoming, ...current };
}

export const getUserIdentityKey = (user: UserAccount) => {
  const stableId = (user.id ?? "").trim();
  const emailKey = normalizeEmailKey(user.email);
  const fallbackMeta = `${(user.name ?? "").trim().toLowerCase()}|${(user.tel ?? "").trim().toLowerCase()}`;

  if (stableId) return `id:${stableId}`;
  if (emailKey) return `email:${emailKey}`;
  if (fallbackMeta) return `meta:${fallbackMeta}`;
  return "meta:unknown";
};

// Dedupe users by the strongest available identity, then keep the newest row.
export function dedupeUsersByIdentity(users: UserAccount[]): UserAccount[] {
  const byKey = new Map<string, UserAccount>();
  const keyOrder: string[] = [];

  users.forEach((user) => {
    const key = getUserIdentityKey(user);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, user);
      keyOrder.push(key);
      return;
    }

    byKey.set(key, pickPreferredUser(existing, user));
  });

  return keyOrder.map((key) => byKey.get(key)!);
}

export type SubmitPhase = "idle" | "submitting" | "success" | "error";

export const tryAcquireSubmitLock = (lockRef: { current: boolean }, isSubmitting: boolean) => {
  if (isSubmitting || lockRef.current) return false;
  lockRef.current = true;
  return true;
};

export const releaseSubmitLock = (lockRef: { current: boolean }) => {
  lockRef.current = false;
};

export const createRequestId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
};

export const throwIfAborted = (signal?: AbortSignal) => {
  if (!signal?.aborted) return;
  throw new DOMException("Request aborted", "AbortError");
};

export const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export const toFriendlyErrorMessage = (error: unknown, fallbackMessage: string) => {
  const rawMessage =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : String((error as { message?: string } | null)?.message ?? "");

  if (!rawMessage) return fallbackMessage;

  const message = rawMessage.trim();
  const lower = message.toLowerCase();

  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Network connection issue. Please try again.";
  }
  if (
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("not allowed") ||
    lower.includes("insufficient privileges")
  ) {
    return "You do not have permission to perform this action. Please contact an administrator.";
  }
  if (lower.includes("duplicate") || lower.includes("already") || lower.includes("unique")) {
    return "This email is already in use.";
  }

  return message;
};
