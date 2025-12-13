import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string | null;
  className?: string;
}

// กำหนดสีและข้อความให้ตรงกับที่คุณต้องการ
const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'default' | 'secondary' }> = {
  // สถานะภาษาอังกฤษ (Legacy)
  Ready: { label: 'พร้อมใช้', variant: 'success' },
  Borrowed: { label: 'ถูกยืม', variant: 'warning' },
  Repair: { label: 'ส่งซ่อม', variant: 'destructive' },
  Missing: { label: 'หาย', variant: 'destructive' },
  
  // สถานะภาษาไทย (New)
  'พร้อมใช้': { label: 'พร้อมใช้', variant: 'success' },
  'ถูกยืม': { label: 'ถูกยืม', variant: 'warning' },
  'ไม่พร้อมใช้': { label: 'ไม่พร้อมใช้', variant: 'destructive' },
  'ส่งซ่อม': { label: 'ส่งซ่อม', variant: 'warning' },
  'ไม่ใช้แล้ว': { label: 'ไม่ใช้แล้ว', variant: 'secondary' },
  'หาย': { label: 'หาย', variant: 'destructive' },
  'ทิ้งแล้ว': { label: 'ทิ้งแล้ว', variant: 'secondary' },
  'ไม่เปิดใช้งาน': { label: 'ไม่เปิดใช้งาน', variant: 'default' },

  // สถานะสติกเกอร์
  'Pending': { label: 'รอติดสติ๊กเกอร์', variant: 'warning' },
  'Done': { label: 'ติดแล้ว', variant: 'success' },
  'รอติดสติ๊กเกอร์': { label: 'รอติดสติ๊กเกอร์', variant: 'warning' },
  'ติดแล้ว': { label: 'ติดแล้ว', variant: 'success' },
  
  // สถานะ Transaction
  'Active': { label: 'กำลังยืม', variant: 'warning' },
  'Completed': { label: 'คืนแล้ว', variant: 'success' }
};

const variantStyles = {
  success: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200',
  destructive: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200',
  secondary: 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200',
  default: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const safeStatus = status || 'Unknown';
  const config = statusConfig[safeStatus] || { label: safeStatus, variant: 'default' };
  
  return (
    <Badge 
      variant="outline"
      className={cn(
        "font-medium border whitespace-nowrap",
        variantStyles[config.variant],
        className
      )}
    >
      {config.label}
    </Badge>
  );
}