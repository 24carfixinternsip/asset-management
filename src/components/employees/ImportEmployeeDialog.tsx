import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, RotateCcw } from "lucide-react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ImportEmployeeDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// กำหนดโครงสร้างข้อมูลในไฟล์ CSV ให้ตรงกับฟอร์มพนักงาน
interface CSVEmployeeRow {
  emp_code: string;    // *บังคับ
  name: string;        // *บังคับ
  nickname: string;
  department: string;  // ระบุเป็นชื่อแผนก (ระบบจะไปหา ID ให้)
  gender: string;      // ชาย, หญิง, อื่นๆ
  location: string;    // ชั้น 1, ชั้น 2...
  email: string;
  tel: string;
}

export function ImportEmployeeDialog({ isOpen, onClose }: ImportEmployeeDialogProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);

  const resetForm = () => {
    setFile(null);
    setResult(null);
    setProgress(0);
    setIsProcessing(false);
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const downloadTemplate = () => {
    // สร้าง Template ที่มี Header ตรงกับ Interface
    // \uFEFF คือ BOM สำหรับรองรับภาษาไทยใน Excel
    const csvContent = "\uFEFFemp_code,name,nickname,department,gender,location,email,tel\nEMP-001,สมชาย ใจดี,ชาย,IT,ชาย,ชั้น 2,somchai@company.com,081-111-1111\nEMP-002,สมหญิง จริงใจ,หญิง,HR,หญิง,ชั้น 1,somying@company.com,089-999-9999";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "template_import_employees.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setProgress(0);
    }
  };

  // ฟังก์ชันช่วยค้นหา ID แผนกจากชื่อ
  const findDepartmentId = (deptName: string, departments: any[]) => {
    if (!deptName) return null;
    const cleanName = deptName.trim().toLowerCase();
    const found = departments.find(d => d.name.toLowerCase() === cleanName);
    return found ? found.id : null;
  };

  const processImport = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgress(0);
    setResult({ success: 0, errors: [] });

    // 1. ดึงข้อมูลแผนกทั้งหมดมาก่อน เพื่อทำ Mapping (ลด Query ใน Loop)
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('id, name');

    if (deptError) {
      toast.error("ไม่สามารถดึงข้อมูลแผนกได้");
      setIsProcessing(false);
      return;
    }

    Papa.parse<CSVEmployeeRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        const total = rows.length;
        let successCount = 0;
        const errors: string[] = [];

        for (let i = 0; i < total; i++) {
          const row = rows[i];
          const rowIndex = i + 2; // +2 เพราะ row 1 คือ header

          try {
            // Validate Required Fields
            if (!row.emp_code || !row.name) {
              throw new Error(`แถวที่ ${rowIndex}: รหัสพนักงานและชื่อ ห้ามเป็นค่าว่าง`);
            }

            // Map Department Name -> Department ID
            const deptId = findDepartmentId(row.department, departments || []);
            
            // กรณีระบุชื่อแผนกมา แต่หาไม่เจอในระบบ
            if (row.department && !deptId) {
               // warning หรือ throw error ตาม business logic
               // ในที่นี้จะยอมให้ผ่านแต่เป็น null หรือจะ throw ก็ได้
               // throw new Error(`แถวที่ ${rowIndex}: ไม่พบแผนกชื่อ "${row.department}" ในระบบ`);
            }

            // เตรียมข้อมูลสำหรับ Insert
            const employeeData = {
              emp_code: row.emp_code.trim(),
              name: row.name.trim(),
              nickname: row.nickname?.trim() || null,
              gender: row.gender?.trim() || null,
              email: row.email?.trim() || null,
              tel: row.tel?.trim() || null,
              location: row.location?.trim() || null, // เช่น "ชั้น 1"
              department_id: deptId
            };

            // Perform Insert
            const { error: insertError } = await supabase
              .from('employees')
              .insert(employeeData);

            if (insertError) {
              // เช็ค Error code กรณีซ้ำ (Unique violation code: 23505)
              if (insertError.code === '23505') {
                throw new Error(`แถวที่ ${rowIndex}: รหัสพนักงาน ${row.emp_code} มีอยู่ในระบบแล้ว`);
              }
              throw new Error(`แถวที่ ${rowIndex}: ${insertError.message}`);
            }

            successCount++;

          } catch (err: unknown) {
            console.error(err);
            const message = err instanceof Error ? err.message : "Unknown error";
            errors.push(message);
          }

          // Update Progress
          setProgress(Math.round(((i + 1) / total) * 100));
        }

        setIsProcessing(false);
        setResult({ success: successCount, errors });
        
        if (successCount > 0) {
          queryClient.invalidateQueries({ queryKey: ['employees'] });
          toast.success(`นำเข้าสำเร็จ ${successCount} รายการ`);
        }
        
        if (errors.length > 0) {
          toast.warning(`พบข้อผิดพลาด ${errors.length} รายการ`);
        }
      },
      error: (error) => {
        setIsProcessing(false);
        toast.error(`CSV Error: ${error.message}`);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isProcessing && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>นำเข้าพนักงานจากไฟล์ CSV</DialogTitle>
          <DialogDescription>
            ใช้คอลัมน์: emp_code, name, nickname, department, gender, location, email, tel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex justify-between items-center">
            <Label>ไฟล์ CSV</Label>
            <Button variant="link" size="sm" className="h-auto p-0 gap-1" onClick={downloadTemplate}>
              <Download className="h-3 w-3" />
              ดาวน์โหลด Template
            </Button>
          </div>

          {!result ? (
            <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors">
              <Input 
                key={file ? "has-file" : "no-file"} 
                type="file" 
                accept=".csv" 
                className="hidden" 
                id="employee-csv-upload" // เปลี่ยน ID ไม่ให้ชนกับ Product
                onChange={handleFileChange}
                disabled={isProcessing}
              />
              <label htmlFor="employee-csv-upload" className="cursor-pointer flex flex-col items-center w-full">
                {file ? (
                  <>
                    <FileSpreadsheet className="h-10 w-10 text-green-600 mb-2" />
                    <span className="font-medium text-sm text-foreground">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                    <span className="font-medium text-sm">คลิกเพื่อเลือกไฟล์ CSV</span>
                    <span className="text-xs text-muted-foreground">รองรับภาษาไทย (UTF-8)</span>
                  </>
                )}
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert variant={result.errors.length > 0 ? "destructive" : "default"} className={result.errors.length === 0 ? "border-green-200 bg-green-50 text-green-800" : ""}>
                {result.errors.length === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <AlertTitle>สรุปผลการทำงาน</AlertTitle>
                <AlertDescription>
                  สำเร็จ: {result.success} รายการ <br/>
                  ล้มเหลว: {result.errors.length} รายการ
                </AlertDescription>
              </Alert>
              
              {result.errors.length > 0 && (
                <div className="max-h-[100px] overflow-y-auto text-xs p-2 bg-muted rounded border space-y-1">
                  {result.errors.map((err, i) => (
                    <div key={i} className="text-red-600">• {err}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>กำลังประมวลผล...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </div>

        <DialogFooter>
          {result ? (
            <div className="flex gap-2 w-full justify-end">
              <Button variant="outline" onClick={onClose}>ปิดหน้าต่าง</Button>
              <Button onClick={resetForm} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                นำเข้าไฟล์ถัดไป
              </Button>
            </div>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={isProcessing}>
                ยกเลิก
              </Button>
              <Button onClick={processImport} disabled={!file || isProcessing}>
                {isProcessing ? 'กำลังทำงาน...' : 'เริ่มนำเข้าข้อมูล'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}