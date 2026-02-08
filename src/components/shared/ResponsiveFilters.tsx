import type { ReactNode } from "react";
import { useState } from "react";

import { Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface ResponsiveFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  filters?: ReactNode;
  mobileFilters?: ReactNode;
  actions?: ReactNode;
  onClear?: () => void;
  onApply?: () => void;
  sheetTitle?: string;
  sticky?: boolean;
  className?: string;
}

export function ResponsiveFilters({
  searchValue,
  onSearchChange,
  searchPlaceholder = "ค้นหา...",
  searchAriaLabel = "Search",
  filters,
  mobileFilters,
  actions,
  onClear,
  onApply,
  sheetTitle = "ตัวกรอง",
  sticky = false,
  className,
}: ResponsiveFiltersProps) {
  const [open, setOpen] = useState(false);
  const hasFilters = Boolean(filters || mobileFilters);

  const handleApply = () => {
    onApply?.();
    setOpen(false);
  };

  return (
    <section
      className={cn(
        "rounded-2xl border border-border/60 bg-card/85 shadow-sm backdrop-blur",
        sticky && "sticky top-14 z-20 sm:static sm:top-auto",
        className,
      )}
    >
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchAriaLabel}
              className="h-11 bg-background pl-9 text-sm md:h-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {hasFilters && (
              <Button
                variant="outline"
                className="h-11 gap-2 md:hidden"
                onClick={() => setOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                ตัวกรอง
              </Button>
            )}
          </div>
        </div>
        {filters && <div className="hidden flex-wrap items-center gap-2 md:flex">{filters}</div>}
      </div>

      {hasFilters && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{sheetTitle}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              {mobileFilters ?? filters}
              <div className="flex items-center gap-2 pt-2">
                {onClear && (
                  <Button variant="outline" className="h-11 flex-1" onClick={onClear}>
                    ล้างทั้งหมด
                  </Button>
                )}
                <Button
                  className={cn("h-11", onClear ? "flex-1" : "w-full")}
                  onClick={handleApply}
                >
                  {onApply || onClear ? "ใช้ตัวกรอง" : "ปิด"}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </section>
  );
}
