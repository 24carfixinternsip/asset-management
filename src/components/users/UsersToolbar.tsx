import { useState } from "react";
import { Filter, RefreshCw, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { Role, UserStatus } from "./types";

interface UsersToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  roleFilter: "all" | Role;
  statusFilter: "all" | UserStatus;
  onRoleFilterChange: (value: "all" | Role) => void;
  onStatusFilterChange: (value: "all" | UserStatus) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  totalCount: number;
  filteredCount: number;
}

export function UsersToolbar({
  searchValue,
  onSearchChange,
  roleFilter,
  statusFilter,
  onRoleFilterChange,
  onStatusFilterChange,
  onClearFilters,
  onRefresh,
  isRefreshing,
  totalCount,
  filteredCount,
}: UsersToolbarProps) {
  const [openFilterSheet, setOpenFilterSheet] = useState(false);
  const hasActiveFilter = roleFilter !== "all" || statusFilter !== "all";
  const activeFilterCount = (roleFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0);

  return (
    <>
      <Card className="sticky top-[4.25rem] z-20 border-border/70 bg-card/90 shadow-sm backdrop-blur md:static md:top-auto">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search by name, email, phone, or employee code"
                aria-label="Search users"
                className="h-11 rounded-xl bg-background pl-9 text-sm transition-all duration-200 focus-visible:ring-orange-300/70 md:h-10"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-11 w-11 rounded-xl transition-all duration-200 active:scale-95 md:hidden"
              aria-label="Refresh users"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>

          <div className="hidden flex-wrap items-end gap-3 md:flex">
            <div className="w-full min-w-[170px] space-y-2 md:w-44">
              <Label className="text-xs font-medium text-muted-foreground">Role</Label>
              <Select value={roleFilter} onValueChange={(value) => onRoleFilterChange(value as "all" | Role)}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full min-w-[170px] space-y-2 md:w-44">
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as "all" | UserStatus)}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="h-10 gap-2 rounded-xl transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={onClearFilters}
                disabled={!hasActiveFilter}
                className="h-10 rounded-xl text-muted-foreground"
              >
                Clear filters
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 md:hidden">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenFilterSheet(true)}
              className="h-10 gap-2 rounded-xl"
            >
              <Filter className="h-4 w-4" />
              Filter
              {hasActiveFilter ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[11px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={onClearFilters}
              disabled={!hasActiveFilter}
              className="h-10 rounded-xl text-muted-foreground"
            >
              Clear
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Showing {filteredCount.toLocaleString()} of {totalCount.toLocaleString()} users</span>
            {hasActiveFilter ? (
              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Sheet open={openFilterSheet} onOpenChange={setOpenFilterSheet}>
        <SheetContent
          side="bottom"
          className="h-[75dvh] rounded-t-3xl border-x-0 border-b-0 p-0 [&>button]:hidden"
        >
          <div className="flex h-full flex-col">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
              <div>
                <p className="text-sm font-semibold">Filters</p>
                <p className="text-xs text-muted-foreground">Adjust role and status criteria.</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => setOpenFilterSheet(false)}
                aria-label="Close filters"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Role</Label>
                <Select value={roleFilter} onValueChange={(value) => onRoleFilterChange(value as "all" | Role)}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as "all" | UserStatus)}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="All status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="sticky bottom-0 border-t bg-background/95 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClearFilters}
                  className="h-11 flex-1 rounded-xl"
                >
                  Clear filters
                </Button>
                <Button
                  type="button"
                  onClick={() => setOpenFilterSheet(false)}
                  className="h-11 flex-1 rounded-xl"
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
