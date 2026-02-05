import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2 } from "lucide-react";
import { ReactNode } from "react";

interface MasterDataTableProps<T> {
  data: T[] | undefined;
  isLoading: boolean;
  emptyMessage: string;
  columns: { header: string; width?: string }[];
  renderRow: (item: T) => ReactNode;
  onDelete: (item: T) => void;
}

export function MasterDataTable<T extends { id: string }>({
  data,
  isLoading,
  emptyMessage,
  columns,
  renderRow,
  onDelete,
}: MasterDataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col, idx) => (
            <TableHead key={idx} style={{ width: col.width }}>
              {col.header}
            </TableHead>
          ))}
          <TableHead className="text-right w-[100px]">จัดการ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRow key={item.id}>
            {renderRow(item)}
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(item)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
