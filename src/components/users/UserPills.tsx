import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { ROLE_LABELS, STATUS_LABELS, normalizeRole, normalizeStatus } from "./users-utils";
import type { Role, UserStatus } from "./types";

const roleStyles: Record<Role, string> = {
  admin: "border-orange-200 bg-orange-50 text-orange-700",
  employee: "border-slate-200 bg-slate-50 text-slate-700",
};

const statusStyles: Record<UserStatus, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  inactive: "border-rose-200 bg-rose-50 text-rose-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
};

export function RolePill({ role, className }: { role?: string | null; className?: string }) {
  const safeRole = normalizeRole(role);

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-transform duration-200 hover:-translate-y-0.5",
        roleStyles[safeRole],
        className,
      )}
    >
      {ROLE_LABELS[safeRole]}
    </Badge>
  );
}

export function StatusPill({ status, className }: { status?: string | null; className?: string }) {
  const safeStatus = normalizeStatus(status);

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-transform duration-200 hover:-translate-y-0.5",
        statusStyles[safeStatus],
        className,
      )}
    >
      {STATUS_LABELS[safeStatus]}
    </Badge>
  );
}
