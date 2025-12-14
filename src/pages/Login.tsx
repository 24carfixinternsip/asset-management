import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ฟังก์ชันช่วยตรวจสอบ Role และ Redirect ไปยังหน้าที่ถูกต้อง
  const checkRoleAndRedirect = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 คือไม่เจอข้อมูล (อาจเป็น User ใหม่)
        console.error("Error checking role:", error);
      }

      // Logic การ Redirect
      if (data?.role === 'admin') {
        navigate("/"); // Admin ไปหน้า Dashboard
      } else {
        navigate("/portal"); // คนอื่นไปหน้า Portal
      }
    } catch (err) {
      console.error("Redirect error:", err);
      navigate("/portal"); // Fallback ไป Portal เพื่อความปลอดภัย
    }
  };

  // 1. ตรวจสอบ session ตอนเข้าหน้าเว็บ (ถ้า Login ค้างไว้แล้ว)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setLoading(true);
        await checkRoleAndRedirect(session.user.id);
        setLoading(false);
      }
    };
    checkSession();
  }, [navigate]);

  // 2. ฟังก์ชันกดปุ่ม Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message === "Invalid login credentials" 
          ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง" 
          : error.message);
        setLoading(false);
      } else if (data.user) {
        toast.success("เข้าสู่ระบบสำเร็จ");
        // Login ผ่านแล้ว -> เช็ค Role เพื่อ Redirect
        await checkRoleAndRedirect(data.user.id);
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 px-4">
      <Card className="w-full max-w-md shadow-lg border-0 bg-white">
        <CardHeader className="space-y-1 text-center pb-8">
          <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Stock Management</CardTitle>
          <CardDescription>
            ระบบจัดการสต็อกสำหรับฝ่ายจัดซื้อและคลังสินค้า
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังตรวจสอบสิทธิ์...
                </>
              ) : (
                "เข้าสู่ระบบ"
              )}
            </Button>
            <div className="text-center text-xs text-muted-foreground mt-4">
              * หากไม่มีบัญชี กรุณาติดต่อผู้ดูแลระบบ (Admin)
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}