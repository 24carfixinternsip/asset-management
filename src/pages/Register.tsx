import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react"; // เพิ่ม icon

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // State สำหรับเปิด/ปิดรหัสผ่าน
  const [showPassword, setShowPassword] = useState(false);

  // Data State
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    nickname: "",
    tel: "",
    department_id: "",
  });

  // Departments State
  const [departments, setDepartments] = useState<any[]>([]);

  // โหลดรายชื่อแผนกมาแสดงใน Dropdown
  useEffect(() => {
    const fetchDepartments = async () => {
      const { data } = await supabase.from("departments").select("id, name");
      if (data) setDepartments(data);
    };
    fetchDepartments();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.department_id) {
      toast.error("กรุณาเลือกแผนก");
      return;
    }

    setLoading(true);
    
    // ส่งข้อมูลทั้งหมดไปพร้อมกับการสมัคร (เพื่อให้ Trigger ทำงาน)
    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          name: formData.name,
          nickname: formData.nickname,
          // ส่ง tel ไปด้วย (ถ้าเป็นค่าว่าง DB จะรับเป็น empty string หรือ null ตามที่ตั้งไว้)
          tel: formData.tel || null, 
          department_id: formData.department_id,
        },
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      await supabase.auth.signOut();
      toast.success("Registration successful. Please log in.");
      setTimeout(() => navigate("/login"), 1500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">ลงทะเบียนพนักงาน</CardTitle>
          <p className="text-center text-gray-500 text-sm">กรอกข้อมูลให้ครบถ้วนเพื่อเริ่มใช้งาน</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-3">
            
            {/* ข้อมูลส่วนตัว */}
            <div className="grid grid-cols-2 gap-3">
               <div className="space-y-2">
                <label className="text-sm font-medium">ชื่อ-นามสกุล (ไทย) <span className="text-red-500">*</span></label>
                <Input id="name" placeholder="สมชาย ใจดี" onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ชื่อเล่น</label>
                <Input id="nickname" placeholder="ชาย" onChange={handleChange} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">เบอร์โทรศัพท์</label>
              <Input 
                id="tel" 
                placeholder="08x-xxx-xxxx" 
                onChange={handleChange} 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">แผนก / ฝ่าย <span className="text-red-500">*</span></label>
              <Select 
                required 
                onValueChange={(val) => setFormData({...formData, department_id: val})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกแผนก" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ข้อมูล Login */}
            <div className="pt-2 border-t mt-2">
                <div className="space-y-2 mt-2">
                  <label className="text-sm font-medium">อีเมล (Login) <span className="text-red-500">*</span></label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@company.com" 
                    onChange={handleChange} 
                    required 
                  />
                </div>

                <div className="space-y-2 mt-2 relative">
                  <label className="text-sm font-medium">รหัสผ่าน <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Input 
                      id="password" 
                      type={showPassword ? "text" : "password"} 
                      onChange={handleChange} 
                      required 
                      minLength={6} 
                      className="pr-10"
                    />
                    {/* ปุ่มเปิด/ปิดตา */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-gray-500"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
            </div>

            <Button type="submit" className="w-full mt-4" disabled={loading}>
              {loading ? "กำลังบันทึก..." : "ลงทะเบียน"}
            </Button>

            <div className="text-center text-sm mt-4">
              มีบัญชีแล้ว? <Link to="/login" className="text-blue-600 hover:underline font-medium">เข้าสู่ระบบ</Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;