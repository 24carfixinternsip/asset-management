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
    errors.name = "กรุณาระบุชื่อ-นามสกุล";
  }

  if (mode === "create") {
    if (!trimmedEmail) {
      errors.email = "กรุณาระบุอีเมล";
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = "รูปแบบอีเมลไม่ถูกต้อง";
    }
  }

  if (!values.department_id) {
    errors.department_id = "กรุณาเลือกแผนก";
  }

  if (mode === "create" && values.setupMode === "password") {
    if (!trimmedPassword) {
      errors.password = "กรุณาระบุรหัสผ่านเริ่มต้น";
    } else if (trimmedPassword.length < 8 || !HAS_LETTER_REGEX.test(trimmedPassword) || !HAS_NUMBER_REGEX.test(trimmedPassword)) {
      errors.password = "รหัสผ่านต้องยาวอย่างน้อย 8 ตัว และมีทั้งตัวอักษรและตัวเลข";
    }

    if (!trimmedConfirmPassword) {
      errors.confirmPassword = "กรุณายืนยันรหัสผ่าน";
    } else if (trimmedPassword !== trimmedConfirmPassword) {
      errors.confirmPassword = "รหัสผ่านไม่ตรงกัน";
    }
  }

  return errors;
};

export const generateTempPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let value = "";
  for (let index = 0; index < 12; index += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
};

export interface PasswordStrengthResult {
  label: string;
  toneClass: string;
  checks: Array<{ id: string; label: string; passed: boolean }>;
}

export const getPasswordStrength = (password: string): PasswordStrengthResult => {
  const value = password.trim();
  const checks = [
    { id: "len", label: "อย่างน้อย 8 ตัวอักษร", passed: value.length >= 8 },
    { id: "letter", label: "มีตัวอักษรอังกฤษ", passed: HAS_LETTER_REGEX.test(value) },
    { id: "number", label: "มีตัวเลข", passed: HAS_NUMBER_REGEX.test(value) },
    { id: "special", label: "มีอักขระพิเศษ (แนะนำ)", passed: HAS_SPECIAL_REGEX.test(value) },
  ];
  const score = checks.filter((item) => item.passed).length;

  if (score <= 1) {
    return { label: "อ่อน", toneClass: "text-rose-600", checks };
  }
  if (score <= 2) {
    return { label: "ปานกลาง", toneClass: "text-amber-600", checks };
  }
  if (score <= 3) {
    return { label: "ดี", toneClass: "text-emerald-600", checks };
  }
  return { label: "แข็งแรง", toneClass: "text-emerald-700", checks };
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
    return "การเชื่อมต่อเครือข่ายมีปัญหา กรุณาลองใหม่";
  }
  if (
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("not allowed") ||
    lower.includes("insufficient privileges")
  ) {
    return "คุณไม่มีสิทธิ์ดำเนินการนี้ กรุณาติดต่อผู้ดูแลระบบ";
  }
  if (lower.includes("duplicate") || lower.includes("already") || lower.includes("unique")) {
    return "อีเมลนี้ถูกใช้งานแล้ว";
  }

  return message;
};
