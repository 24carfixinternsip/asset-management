import type { ReactNode } from "react";
import { AlertCircle, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { RolePill, StatusPill } from "./UserPills";
import type { UserAccount } from "./types";

interface UsersTableProps {
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

const getUserListKey = (user: UserAccount) =>
  (user.id ?? "").trim() ||
  (user.email ?? "").trim().toLowerCase() ||
  (user.emp_code ?? "").trim() ||
  `${(user.name ?? "user").trim()}-${(user.tel ?? "na").trim()}`;

function LoadingRow() {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell>
        <div className="space-y-2">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-3 w-24" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-28" />
      </TableCell>
      <TableCell className="text-center">
        <Skeleton className="mx-auto h-7 w-24 rounded-full" />
      </TableCell>
      <TableCell className="text-center">
        <Skeleton className="mx-auto h-7 w-24 rounded-full" />
      </TableCell>
      <TableCell className="text-right">
        <Skeleton className="ml-auto h-9 w-9 rounded-xl" />
      </TableCell>
    </TableRow>
  );
}

export function UsersTable({ users, isLoading, errorMessage, onRetry, renderActions }: UsersTableProps) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardContent className="p-0">
        <div className="max-h-[calc(100vh-20rem)] overflow-y-auto">
          <Table className="table-fixed">
            <TableHeader className="sticky top-0 z-20 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[36%]">User</TableHead>
                <TableHead className="w-[24%]">Department</TableHead>
                <TableHead className="w-[14%] text-center">Role</TableHead>
                <TableHead className="w-[14%] text-center">Status</TableHead>
                <TableHead className="w-[12%] pr-5 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {errorMessage ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-12">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <AlertCircle className="h-10 w-10 text-rose-400" />
                      <p className="max-w-md text-sm text-muted-foreground">{errorMessage}</p>
                      <Button type="button" variant="outline" onClick={onRetry} className="rounded-xl">
                        ลองใหม่
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : isLoading ? (
                Array.from({ length: 6 }).map((_, index) => <LoadingRow key={`users-loading-${index}`} />)
              ) : users.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-14">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <Users className="h-12 w-12 text-muted-foreground/35" />
                      <p className="text-sm text-muted-foreground">ไม่พบผู้ใช้งานที่ตรงกับเงื่อนไข</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow
                    key={getUserListKey(user)}
                    className="group border-border/70 transition-all duration-200 hover:bg-orange-50/40"
                  >
                    <TableCell>
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold text-foreground">{user.name || "-"}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email || "-"}</p>
                        <p className="text-xs text-muted-foreground">{user.tel || "-"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-foreground/90" style={twoLineClampStyle}>
                        {user.departments?.name || "ไม่ระบุแผนก"}
                      </p>
                    </TableCell>
                    <TableCell className="text-center">
                      <RolePill role={user.role} className="mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusPill status={user.status} className="mx-auto" />
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <div className="flex justify-end">{renderActions(user)}</div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
