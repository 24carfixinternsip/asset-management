import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Mail, UserCog, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Department } from "@/hooks/useMasterData";
import { cn } from "@/lib/utils";

import type { FormMode, Role, UserFormValues } from "./types";
import { createDefaultUserFormValues, getPasswordStrength, validateUserForm } from "./users-utils";

interface AddUserModalProps {
  open: boolean;
  mode: FormMode;
  isSubmitting: boolean;
  submitError?: string | null;
  departments?: Department[];
  initialValues?: Partial<UserFormValues>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: UserFormValues) => Promise<void> | void;
}

const titleByMode: Record<FormMode, string> = {
  create: "Add User",
  edit: "Edit User",
  view: "User Details",
};

const descriptionByMode: Record<FormMode, string> = {
  create: "Fill in account details and set first-time access.",
  edit: "Update profile, access role, and account status.",
  view: "Read-only view of account details.",
};

const requiredMark = <span className="text-rose-500"> *</span>;

function FieldLabel({ htmlFor, text, required }: { htmlFor: string; text: string; required?: boolean }) {
  return (
    <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
      {text}
      {required ? requiredMark : null}
    </Label>
  );
}

export function AddUserModal({
  open,
  mode,
  isSubmitting,
  submitError,
  departments,
  initialValues,
  onOpenChange,
  onSubmit,
}: AddUserModalProps) {
  const isMobile = useIsMobile();
  const wasOpenRef = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<keyof UserFormValues, boolean>>>({});
  const [values, setValues] = useState<UserFormValues>(() => ({
    ...createDefaultUserFormValues(),
    ...(initialValues ?? {}),
  }));

  useEffect(() => {
    const opened = open && !wasOpenRef.current;
    if (opened) {
      setValues({
        ...createDefaultUserFormValues(),
        ...(initialValues ?? {}),
      });
      setShowPassword(false);
      setShowConfirmPassword(false);
      setAttemptedSubmit(false);
      setTouched({});
    }

    if (!open && wasOpenRef.current) {
      setAttemptedSubmit(false);
      setTouched({});
    }

    wasOpenRef.current = open;
  }, [open, initialValues, mode]);

  useEffect(() => {
    if (!open || mode !== "create") return;

    if (values.setupMode === "invite") {
      setValues((current) => ({
        ...current,
        password: "",
        confirmPassword: "",
      }));
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [open, mode, values.setupMode]);

  const validationErrors = useMemo(() => validateUserForm(values, mode), [mode, values]);
  const passwordStrength = useMemo(() => getPasswordStrength(values.password), [values.password]);
  const canSubmit = mode !== "view" && Object.keys(validationErrors).length === 0 && !isSubmitting;
  const readOnly = mode === "view";

  const updateField = <K extends keyof UserFormValues>(key: K, value: UserFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const markTouched = (field: keyof UserFormValues) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const visibleError = (field: keyof UserFormValues) => {
    if (!attemptedSubmit && !touched[field]) return null;
    return validationErrors[field] ?? null;
  };

  const closeModal = () => onOpenChange(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "view") return;
    if (isSubmitting) return;

    setAttemptedSubmit(true);
    if (Object.keys(validationErrors).length > 0) return;

    try {
      await onSubmit(values);
    } catch {
      // Parent handles toast + inline error state.
    }
  };

  const formContent = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border/70 bg-background px-4 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <UserCog className="h-5 w-5 text-orange-500" />
              {titleByMode[mode]}
            </h2>
            <p className="text-sm text-muted-foreground">{descriptionByMode[mode]}</p>
          </div>

          {isMobile && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={closeModal}
              aria-label="Close form"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {submitError ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {submitError}
            </div>
          ) : null}

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <FieldLabel htmlFor="users-name" text="Full name" required />
              <Input
                id="users-name"
                value={values.name}
                onChange={(event) => updateField("name", event.target.value)}
                onBlur={() => markTouched("name")}
                disabled={readOnly || isSubmitting}
                aria-invalid={Boolean(visibleError("name"))}
                aria-describedby={visibleError("name") ? "users-name-error" : undefined}
                className="h-11 rounded-xl transition-all duration-200 focus-visible:ring-orange-300/70"
              />
              {visibleError("name") ? (
                <p id="users-name-error" className="text-xs text-rose-600">
                  {visibleError("name")}
                </p>
              ) : null}
            </div>

            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <FieldLabel htmlFor="users-email" text="Email" required={mode === "create"} />
              <Input
                id="users-email"
                type="email"
                value={values.email}
                onChange={(event) => updateField("email", event.target.value)}
                onBlur={() => markTouched("email")}
                disabled={mode !== "create" || isSubmitting}
                aria-invalid={Boolean(visibleError("email"))}
                aria-describedby={visibleError("email") ? "users-email-error" : undefined}
                className="h-11 rounded-xl transition-all duration-200 focus-visible:ring-orange-300/70"
              />
              {visibleError("email") ? (
                <p id="users-email-error" className="text-xs text-rose-600">
                  {visibleError("email")}
                </p>
              ) : null}
            </div>

            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <FieldLabel htmlFor="users-tel" text="Phone" />
              <Input
                id="users-tel"
                value={values.tel}
                onChange={(event) => updateField("tel", event.target.value)}
                disabled={readOnly || isSubmitting}
                className="h-11 rounded-xl transition-all duration-200 focus-visible:ring-orange-300/70"
              />
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="users-role" text="Role" required />
              <Select
                value={values.role}
                onValueChange={(value) => updateField("role", value as Role)}
                disabled={readOnly || isSubmitting}
              >
                <SelectTrigger id="users-role" className="h-11 rounded-xl">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="users-status" text="Status" required />
              <Select
                value={values.status}
                onValueChange={(value) => updateField("status", value as "active" | "inactive")}
                disabled={readOnly || isSubmitting}
              >
                <SelectTrigger id="users-status" className="h-11 rounded-xl">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <FieldLabel htmlFor="users-department" text="Department" required />
              <Select
                value={values.department_id || "__none__"}
                onValueChange={(value) => {
                  updateField("department_id", value === "__none__" ? "" : value);
                  markTouched("department_id");
                }}
                disabled={readOnly || isSubmitting}
              >
                <SelectTrigger id="users-department" className="h-11 rounded-xl">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>
                    Select department
                  </SelectItem>
                  {(departments ?? []).map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {visibleError("department_id") ? (
                <p className="text-xs text-rose-600">{visibleError("department_id")}</p>
              ) : null}
            </div>
          </section>

          {mode === "create" ? (
            <section className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-3 sm:p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <KeyRound className="h-4 w-4" />
                  Access Setup
                </div>
                <p className="text-xs text-muted-foreground">Choose how the user receives first-time access.</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => updateField("setupMode", "invite")}
                  aria-pressed={values.setupMode === "invite"}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition-all duration-200",
                    values.setupMode === "invite"
                      ? "border-orange-200 bg-orange-50 text-orange-700"
                      : "border-border bg-background text-foreground",
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Send invitation link
                  </span>
                  {values.setupMode === "invite" ? <Check className="h-4 w-4" /> : null}
                </button>

                <button
                  type="button"
                  onClick={() => updateField("setupMode", "password")}
                  aria-pressed={values.setupMode === "password"}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition-all duration-200",
                    values.setupMode === "password"
                      ? "border-orange-200 bg-orange-50 text-orange-700"
                      : "border-border bg-background text-foreground",
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    Set initial password
                  </span>
                  {values.setupMode === "password" ? <Check className="h-4 w-4" /> : null}
                </button>
              </div>

              {values.setupMode === "invite" ? (
                <p className="rounded-xl border border-orange-100 bg-orange-50/60 px-3 py-2 text-xs leading-relaxed text-orange-800">
                  The system will send a secure link to the user so they can set a password by themselves.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <FieldLabel htmlFor="users-password" text="Initial password" required />
                    <div className="relative">
                      <Input
                        id="users-password"
                        type={showPassword ? "text" : "password"}
                        value={values.password}
                        onChange={(event) => updateField("password", event.target.value)}
                        onBlur={() => markTouched("password")}
                        disabled={isSubmitting}
                        aria-invalid={Boolean(visibleError("password"))}
                        aria-describedby={visibleError("password") ? "users-password-error" : "users-password-helper"}
                        className="h-11 rounded-xl pr-10 transition-all duration-200 focus-visible:ring-orange-300/70"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors duration-200 hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {visibleError("password") ? (
                      <p id="users-password-error" className="text-xs text-rose-600">
                        {visibleError("password")}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <FieldLabel htmlFor="users-confirm-password" text="Confirm password" required />
                    <div className="relative">
                      <Input
                        id="users-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={values.confirmPassword}
                        onChange={(event) => updateField("confirmPassword", event.target.value)}
                        onBlur={() => markTouched("confirmPassword")}
                        disabled={isSubmitting}
                        aria-invalid={Boolean(visibleError("confirmPassword"))}
                        aria-describedby={visibleError("confirmPassword") ? "users-confirm-password-error" : undefined}
                        className="h-11 rounded-xl pr-10 transition-all duration-200 focus-visible:ring-orange-300/70"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors duration-200 hover:text-foreground"
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {visibleError("confirmPassword") ? (
                      <p id="users-confirm-password-error" className="text-xs text-rose-600">
                        {visibleError("confirmPassword")}
                      </p>
                    ) : null}
                  </div>

                  <div
                    id="users-password-helper"
                    className="rounded-xl border border-border/70 bg-background px-3 py-2 text-xs md:col-span-2"
                  >
                    <p className={cn("mb-2 font-medium", passwordStrength.toneClass)}>
                      Password strength: {passwordStrength.label}
                    </p>
                    <div className="grid gap-1">
                      {passwordStrength.checks.map((checkItem) => (
                        <p
                          key={checkItem.id}
                          className={cn(
                            "inline-flex items-center gap-1",
                            checkItem.passed ? "text-emerald-600" : "text-muted-foreground",
                          )}
                        >
                          <Check className="h-3.5 w-3.5" />
                          {checkItem.label}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          ) : null}
        </div>

        <div className="sticky bottom-0 border-t border-border/70 bg-background/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur sm:px-6">
          <div
            className={cn(
              "flex items-center gap-2",
              isMobile && mode !== "view" ? "grid w-full grid-cols-2" : "justify-end",
            )}
          >
            <Button
              type="button"
              variant="outline"
              onClick={closeModal}
              disabled={isSubmitting}
              className={cn("h-10 rounded-xl", isMobile && "w-full")}
            >
              Close
            </Button>
            {mode !== "view" ? (
              <Button
                type="submit"
                disabled={!canSubmit}
                className={cn(
                  "h-10 min-w-32 rounded-xl transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0",
                  isMobile && "w-full min-w-0",
                )}
              >
                {isSubmitting ? "Saving..." : mode === "create" ? "Create User" : "Save Changes"}
              </Button>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[100dvh] max-h-[100dvh] overflow-hidden rounded-none border-0 p-0 data-[state=open]:duration-200 data-[state=closed]:duration-200 [&>button]:hidden"
        >
          {formContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[min(96vw,760px)] overflow-hidden rounded-2xl border-border/70 p-0 data-[state=open]:duration-200 data-[state=closed]:duration-200">
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
