import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ResponsiveTableProps {
  table: ReactNode;
  stacked: ReactNode;
  className?: string;
}

export function ResponsiveTable({ table, stacked, className }: ResponsiveTableProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="hidden md:block">{table}</div>
      <div className="md:hidden">{stacked}</div>
    </div>
  );
}
