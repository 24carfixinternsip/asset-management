import { Button } from "@/components/ui/button";

interface MasterDataEmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function MasterDataEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: MasterDataEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {actionLabel && onAction ? (
        <Button type="button" variant="outline" onClick={onAction} className="h-10 rounded-xl px-4">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
