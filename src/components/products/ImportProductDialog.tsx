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

interface ImportProductDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CSVRow {
  name: string;
  category: string;
  brand: string;
  model: string;
  price: string;
  unit: string;
  quantity: string;
  description: string;
  notes: string;
}

const SYSTEM_CATEGORIES = [
  "ไอที/อิเล็กทรอนิกส์ (IT)",
  "เฟอร์นิเจอร์ (FR)",
  "เครื่องมือ/อุปกรณ์ช่าง (TL)",
  "เสื้อผ้าและเครื่องแต่งกาย (CL)",
  "วัสดุสิ้นเปลือง (CS)",
  "อุปกรณ์สำนักงาน (ST)",
  "อะไหล่/ชิ้นส่วนสำรอง (SP)",
  "เครื่องใช้ไฟฟ้าบาง (AP)",
  "อุปกรณ์ความปลอดภัย (PP)",
  "อุปกรณ์โสต/สื่อ (AV)",
];

export function ImportProductDialog({ isOpen, onClose }: ImportProductDialogProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);

  // ฟังก์ชันล้างค่าทั้งหมด เพื่อเริ่มใหม่
  const resetForm = () => {
    setFile(null);
    setResult(null);
    setProgress(0);
    setIsProcessing(false);
  };

  // *** แก้ไข: เมื่อเปิด Dialog ให้ Reset ค่าเสมอ ***
  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const downloadTemplate = () => {
    const csvContent = "\uFEFFname,category,brand,model,price,unit,quantity,description,notes\nDell Latitude 3420,IT,Dell,3420,25000,เครื่อง,5,Core i5 RAM 8GB,ล็อตปี 67\nเก้าอี้สำนักงาน,FR,IKEA,Markus,5900,ตัว,2,สีดำ พนักพิงสูง,ห้องประชุมเล็ก";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "template_import_products.csv");
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

  const resolveCategory = (input: string): string => {
    const cleanInput = input?.trim().toUpperCase() || "";
    const found = SYSTEM_CATEGORIES.find(sysCat => {
      const match = sysCat.match(/\(([^)]+)\)/);
      const code = match ? match[1] : "";
      return code === cleanInput || sysCat.toUpperCase() === cleanInput;
    });
    return found || SYSTEM_CATEGORIES[0]; 
  };

  const getPrefixFromFullCategory = (fullCategory: string) => {
    const match = fullCategory.match(/\(([^)]+)\)/);
    return match ? match[1].toUpperCase() : "GEN";
  };

  const processImport = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgress(0);
    setResult({ success: 0, errors: [] });

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        const total = rows.length;
        let successCount = 0;
        const errors: string[] = [];

        for (let i = 0; i < total; i++) {
          const row = rows[i];
          const rowIndex = i + 2;

          try {
            if (!row.name) {
              throw new Error(`แถวที่ ${rowIndex}: ชื่อสินค้าห้ามว่าง`);
            }

            const systemCategory = resolveCategory(row.category); 
            const prefix = getPrefixFromFullCategory(systemCategory);
            
            const { data: lastData } = await supabase
              .from('products')
              .select('p_id')
              .ilike('p_id', `${prefix}-%`)
              .order('p_id', { ascending: false })
              .limit(1);

            let nextNumber = 1;
            if (lastData && lastData.length > 0) {
              const lastCode = lastData[0].p_id;
              const match = lastCode.match(/-(\d+)$/);
              if (match) {
                nextNumber = parseInt(match[1], 10) + 1;
              }
            }
            
            const newSku = `${prefix}-${String(nextNumber).padStart(4, '0')}`;
            const initialQty = parseInt(row.quantity) || 0;

            const { data: product, error: prodError } = await supabase
              .from('products')
              .insert({
                p_id: newSku,
                name: row.name,
                category: systemCategory,
                brand: row.brand || null,
                model: row.model || null,
                price: parseFloat(row.price) || 0,
                unit: row.unit || 'ชิ้น',
                description: row.description || null,
                notes: row.notes || null,
                quantity: initialQty
              })
              .select()
              .single();

            if (prodError) throw new Error(`แถวที่ ${rowIndex} (Product): ${prodError.message}`);

            if (initialQty > 0 && product) {
              const serials = Array.from({ length: initialQty }, (_, k) => ({
                product_id: product.id,
                serial_code: `${newSku}-${String(k + 1).padStart(4, '0')}`,
                status: 'พร้อมใช้',
                sticker_status: 'รอติดสติ๊กเกอร์'
              }));

              const { error: serialError } = await supabase
                .from('product_serials')
                .insert(serials);

              if (serialError) {
                console.error(serialError);
              }
            }

            successCount++;

          } catch (err: unknown) {
            console.error(err);
            const message = err instanceof Error ? err.message : "Unknown error";
            errors.push(message || `Error at row ${rowIndex}`);
          }

          setProgress(Math.round(((i + 1) / total) * 100));
        }

        setIsProcessing(false);
        setResult({ success: successCount, errors });
        
        if (successCount > 0) {
          queryClient.invalidateQueries({ queryKey: ['products'] });
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
          <DialogTitle>นำเข้าสินค้าจากไฟล์ CSV</DialogTitle>
          <DialogDescription>
            รองรับรหัสหมวดหมู่แบบย่อ (เช่น IT, FR, TL)
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
                // ใช้ key เพื่อบังคับให้ Input reset ตัวเองเมื่อเคลียร์ไฟล์
                key={file ? "has-file" : "no-file"} 
                type="file" 
                accept=".csv" 
                className="hidden" 
                id="csv-upload"
                onChange={handleFileChange}
                disabled={isProcessing}
              />
              <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center w-full">
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
                    <span className="text-xs text-muted-foreground">ต้องเป็น UTF-8 (เพื่อรองรับภาษาไทย)</span>
                  </>
                )}
              </label>
            </div>
          ) : (
            // ส่วนแสดงผลลัพธ์
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
            // *** ปุ่มใหม่สำหรับสถานะหลัง Import เสร็จ ***
            <div className="flex gap-2 w-full justify-end">
              <Button variant="outline" onClick={onClose}>ปิดหน้าต่าง</Button>
              <Button onClick={resetForm} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                นำเข้าไฟล์ถัดไป
              </Button>
            </div>
          ) : (
            // ปุ่มปกติสำหรับสถานะเลือกไฟล์
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
