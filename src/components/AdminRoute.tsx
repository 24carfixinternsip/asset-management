import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { role, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  // ถ้าไม่ใช่ Admin ให้ดีดกลับไปหน้า Portal ทันที
  if (role !== "admin") {
    return <Navigate to="/portal" replace />;
  }

  // ถ้าเป็น Admin ให้ผ่านไปได้
  return <>{children}</>;
};