import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type CardGridProps = HTMLAttributes<HTMLDivElement>;

export function CardGrid({ className, ...props }: CardGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:gap-5",
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
      {...props}
    />
  );
}
