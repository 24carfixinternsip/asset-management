import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string | null;
  className?: string;
}

// Centralized semantic status mapping
const statusConfig: Record<
  string,
  { label: string; variant: "success" | "warning" | "destructive" | "default" | "secondary" | "info" }
> = {
  // Legacy (EN)
  Ready: { label: "พร้อมใช้", variant: "success" },
  Borrowed: { label: "ถูกยืม", variant: "warning" },
  Repair: { label: "ส่งซ่อม", variant: "destructive" },
  Missing: { label: "หาย", variant: "destructive" },

  // Inventory (TH)
  "พร้อมใช้": { label: "พร้อมใช้", variant: "success" },
  "ถูกยืม": { label: "ถูกยืม", variant: "warning" },
  "ไม่พร้อมใช้": { label: "ไม่พร้อมใช้", variant: "destructive" },
  "ส่งซ่อม": { label: "ส่งซ่อม", variant: "warning" },
  "ไม่ใช้งานแล้ว": { label: "ไม่ใช้งานแล้ว", variant: "secondary" },
  "หาย": { label: "หาย", variant: "destructive" },
  "ทิ้งแล้ว": { label: "ทิ้งแล้ว", variant: "secondary" },
  "ไม่เปิดใช้งาน": { label: "ไม่เปิดใช้งาน", variant: "default" },

  // Sticker
  Done: { label: "ติดแล้ว", variant: "success" },
  "รอติดสติ๊กเกอร์": { label: "รอติดสติ๊กเกอร์", variant: "warning" },
  "ติดแล้ว": { label: "ติดแล้ว", variant: "success" },

  // Transaction (EN)
  Pending: { label: "รออนุมัติ", variant: "warning" },
  Active: { label: "อนุมัติแล้ว", variant: "info" },
  Completed: { label: "คืนแล้ว", variant: "success" },
  Rejected: { label: "ปฏิเสธ", variant: "destructive" },
  Approved: { label: "อนุมัติแล้ว", variant: "info" },
  Returned: { label: "คืนแล้ว", variant: "success" },
  Cancelled: { label: "ยกเลิก", variant: "secondary" },

  // Transaction (TH)
  "รออนุมัติ": { label: "รออนุมัติ", variant: "warning" },
  "อนุมัติแล้ว": { label: "อนุมัติแล้ว", variant: "info" },
  "คืนแล้ว": { label: "คืนแล้ว", variant: "success" },
  "ปฏิเสธ": { label: "ปฏิเสธ", variant: "destructive" },
};

const variantStyles = {
  success: "bg-green-100 text-green-700 border-green-200 hover:bg-green-200",
  warning: "bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200",
  destructive: "bg-red-100 text-red-700 border-red-200 hover:bg-red-200",
  secondary: "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200",
  default: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200",
  info: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const safeStatus = status || "Unknown";
  const config = statusConfig[safeStatus] || { label: safeStatus, variant: "default" };

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border whitespace-nowrap transition-colors duration-200 motion-reduce:transition-none",
        variantStyles[config.variant],
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
