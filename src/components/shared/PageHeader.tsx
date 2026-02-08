import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  sticky?: boolean;
  className?: string;
  children?: ReactNode;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  sticky = false,
  className,
  children,
}: PageHeaderProps) {
  return (
    <section
      className={cn(
        sticky && "sticky top-14 z-20 sm:static sm:top-auto",
        className,
      )}
    >
      <div className="rounded-2xl border border-border/60 bg-card/85 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              {eyebrow}
              <h1 className="text-page-title">{title}</h1>
              {description && <div className="text-body text-muted-foreground">{description}</div>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>
          {children ? <div className="pt-1">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
