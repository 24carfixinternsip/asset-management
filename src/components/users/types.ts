import type { Employee } from "@/hooks/useMasterData";

export type Role = "admin" | "employee";
export type UserStatus = "active" | "inactive" | "pending";
export type FormMode = "create" | "edit" | "view";
export type AccessSetup = "invite" | "password";

export type UserAccount = Employee;

export interface UserFormValues {
  name: string;
  email: string;
  tel: string;
  department_id: string;
  role: Role;
  status: Extract<UserStatus, "active" | "inactive">;
  setupMode: AccessSetup;
  password: string;
  confirmPassword: string;
}
