import type { ReactNode } from "react";
import { AlertCircle, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { RolePill, StatusPill } from "./UserPills";
import type { UserAccount } from "./types";

interface UsersCardsProps {
  users: UserAccount[];
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  renderActions: (user: UserAccount) => ReactNode;
}

const twoLineClampStyle = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical" as const,
  overflow: "hidden",
};

function LoadingCard() {
  return (
    <Card className="rounded-2xl border-border/70 bg-card/95">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-52" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-44" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function UsersCards({ users, isLoading, errorMessage, onRetry, renderActions }: UsersCardsProps) {
  if (errorMessage) {
    return (
      <Card className="rounded-2xl border-border/70 bg-card/95">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertCircle className="h-10 w-10 text-rose-400" />
          <p className="max-w-sm text-sm text-muted-foreground">{errorMessage}</p>
          <Button type="button" variant="outline" onClick={onRetry} className="rounded-xl">
            ลองใหม่
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <LoadingCard key={`users-card-loading-${index}`} />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <Card className="rounded-2xl border-border/70 bg-card/95">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground/35" />
          <p className="text-sm text-muted-foreground">ไม่พบผู้ใช้งานที่ตรงกับเงื่อนไข</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {users.map((user) => (
        <Card
          key={user.id}
          className="rounded-2xl border-border/70 bg-card/95 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          <CardContent className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold text-foreground" style={twoLineClampStyle}>
                  {user.name || "-"}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user.email || "-"}</p>
                <p className="text-xs text-muted-foreground">{user.tel || "-"}</p>
              </div>
              <div className="shrink-0">{renderActions(user)}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Department</p>
                <p className="text-sm text-foreground/90" style={twoLineClampStyle}>
                  {user.departments?.name || "ไม่ระบุแผนก"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Role</p>
                <RolePill role={user.role} />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                <StatusPill status={user.status} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
