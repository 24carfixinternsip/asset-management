import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableRow } from "@/components/ui/table";

interface MasterDataTableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function MasterDataTableSkeleton({ rows = 6, columns = 4 }: MasterDataTableSkeletonProps) {
  return (
    <TableBody>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={`master-skeleton-${rowIndex}`}>
          {Array.from({ length: columns }).map((__, colIndex) => (
            <TableCell key={`master-skeleton-${rowIndex}-${colIndex}`}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}

export function MasterDataCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-3 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <article key={`master-card-skeleton-${index}`} className="rounded-2xl border border-border/70 bg-card p-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </article>
      ))}
    </div>
  );
}
