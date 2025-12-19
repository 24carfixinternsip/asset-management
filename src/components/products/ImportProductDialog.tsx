import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, RotateCcw, Loader2 } from "lucide-react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface ImportProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface CSVRow {
  p_id?: string;
  id?: string;
  code?: string;
  name: string;
  product_name?: string;
  category: string;
  brand: string;
  model: string;
  price: string;
  unit: string;
  quantity: string;
  qty?: string;
  description: string;
  notes: string;
  image_url?: string;
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

export function ImportProductDialog({ open, onOpenChange, onSuccess }: ImportProductDialogProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setResult(null);
      setProgress(0);
      setIsProcessing(false);
      setStatusMessage("");
    }
  }, [open]);

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

  // 🔥 Smart ID Generation: ดึงครั้งเดียวแล้วรันต่อใน Memory (เร็วขึ้น 100%)
  const fetchLastIds = async (categories: string[]) => {
    const prefixes = [...new Set(categories.map(c => getPrefixFromFullCategory(c)))];
    const lastIds: Record<string, number> = {};

    for (const prefix of prefixes) {
      const { data } = await supabase
        .from('products')
        .select('p_id')
        .ilike('p_id', `${prefix}-%`)
        .order('p_id', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      let lastNum = 0;
      if (data?.p_id) {
        const parts = data.p_id.split('-');
        const numStr = parts[parts.length - 1];
        lastNum = parseInt(numStr) || 0;
      }
      lastIds[prefix] = lastNum;
    }
    return lastIds;
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

        // 1. เตรียม ID ใน Memory ก่อนเริ่มงาน (ลดการยิง Database)
        setStatusMessage("กำลังวิเคราะห์ข้อมูลและสร้างรหัสสินค้า...");
        const allCategories = rows.map(r => resolveCategory(r.category || ''));
        const runningNumbers = await fetchLastIds(allCategories);

        // 2. Prepare Data with IDs
        const preparedRows = rows.map((row) => {
           const category = resolveCategory(row.category);
           const prefix = getPrefixFromFullCategory(category);
           
           let p_id = row.p_id || row.id || row.code;
           if (!p_id) {
              runningNumbers[prefix] += 1;
              p_id = `${prefix}-${String(runningNumbers[prefix]).padStart(4, '0')}`;
           }
           
           return { ...row, generated_pid: p_id, resolved_category: category };
        });

        // 3. Process in Chunks (Batching) - ทีละ 5 รายการ (Safe Zone)
        const CHUNK_SIZE = 5; 
        
        for (let i = 0; i < total; i += CHUNK_SIZE) {
          const chunk = preparedRows.slice(i, i + CHUNK_SIZE);
          setStatusMessage(`กำลังบันทึกรายการที่ ${i + 1} - ${Math.min(i + CHUNK_SIZE, total)} จาก ${total}...`);

          // ใช้ Promise.all เพื่อทำ 5 รายการพร้อมกัน (คนงาน 5 คน)
          await Promise.all(chunk.map(async (row) => {
             const rowIndex = i + chunk.indexOf(row) + 2;
             try {
                const name = row.name || row.product_name;
                if (!name) return; // Skip empty rows

                const quantity = parseInt(row.quantity || row.qty || '0') || 0;
                const price = parseFloat(row.price) || 0;

                // A. สร้างสินค้า
                const { data: product, error: prodError } = await supabase
                  .from('products')
                  .upsert({
                    p_id: row.generated_pid,
                    name: name,
                    category: row.resolved_category,
                    brand: row.brand || '',
                    model: row.model || '',
                    price: price,
                    unit: row.unit || 'ชิ้น',
                    description: row.description || '',
                    notes: row.notes || '',
                    quantity: quantity, // Reference
                    image_url: row.image_url || null
                  }, { onConflict: 'p_id' })
                  .select()
                  .single();

                if (prodError) throw new Error(prodError.message);

                // B. สร้าง Serial (สำคัญ!)
                if (quantity > 0 && product) {
                   // เช็คก่อนว่ามี Serial เท่าไหร่แล้ว
                   const { count } = await supabase
                      .from('product_serials')
                      .select('*', { count: 'exact', head: true })
                      .eq('product_id', product.id);
                   
                   const currentCount = count || 0;
                   const needed = quantity - currentCount;

                   if (needed > 0) {
                      const newSerials = Array.from({ length: needed }, (_, k) => ({
                        product_id: product.id,
                        serial_code: `${product.p_id}-${String(currentCount + k + 1).padStart(4, '0')}`,
                        status: 'พร้อมใช้',
                        sticker_status: 'รอติดสติ๊กเกอร์'
                      }));

                      // ยิงเข้า DB ทีเดียว (Batch Insert Serial)
                      const { error: serialError } = await supabase
                        .from('product_serials')
                        .insert(newSerials);

                      if (serialError) {
                         console.error(`Serial Error ${product.p_id}:`, serialError);
                         errors.push(`สินค้า ${name} สร้างสำเร็จ แต่สร้าง Serial ไม่ครบ (${serialError.message})`);
                      }
                   }
                }
                successCount++;
             } catch (err: any) {
                console.error(`Error row ${rowIndex}:`, err);
                errors.push(`แถว ${rowIndex} (${row.name}): ${err.message}`);
             }
          }));

          // อัปเดต Progress
          setProgress(Math.round((Math.min(i + CHUNK_SIZE, total) / total) * 100));
          
          // พักหายใจนิดนึงป้องกัน Rate Limit (Optional)
          await new Promise(resolve => setTimeout(resolve, 50)); 
        }

        setIsProcessing(false);
        setResult({ success: successCount, errors });
        setStatusMessage("เสร็จสิ้น!");
        
        if (successCount > 0) {
          queryClient.invalidateQueries({ queryKey: ['products'] });
          toast.success(`นำเข้าสำเร็จ ${successCount} รายการ`);
          onSuccess();
        }
        
        if (errors.length > 0) {
          toast.warning(`พบปัญหา ${errors.length} รายการ`);
        }
      },
      error: (error) => {
        setIsProcessing(false);
        toast.error(`อ่านไฟล์ CSV ล้มเหลว: ${error.message}`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isProcessing && onOpenChange(val)}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>นำเข้าสินค้าจากไฟล์ CSV</DialogTitle>
          <VisuallyHidden>
            <DialogDescription>Import products from CSV</DialogDescription>
          </VisuallyHidden>
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
                    <span className="font-medium text-sm">คลิกเพื่อเลือกไฟล์</span>
                    <span className="text-xs text-muted-foreground">รองรับภาษาไทย (UTF-8)</span>
                  </>
                )}
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert variant={result.errors.length > 0 ? "destructive" : "default"} className={result.errors.length === 0 ? "border-green-200 bg-green-50 text-green-800" : ""}>
                {result.errors.length === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <AlertTitle>สรุปผลการนำเข้า</AlertTitle>
                <AlertDescription>
                  สำเร็จ: {result.success} รายการ <br/>
                  ไม่สำเร็จ: {result.errors.length} รายการ
                </AlertDescription>
              </Alert>
              
              {result.errors.length > 0 && (
                <div className="max-h-[150px] overflow-y-auto text-xs p-2 bg-muted rounded border space-y-1">
                  {result.errors.map((err, i) => (
                    <div key={i} className="text-red-600 border-b last:border-0 pb-1 border-red-100">• {err}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{statusMessage}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>

        <DialogFooter>
          {result ? (
            <div className="flex gap-2 w-full justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>ปิดหน้าต่าง</Button>
              <Button onClick={() => { setFile(null); setResult(null); setProgress(0); }} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                นำเข้าไฟล์ต่อไป
              </Button>
            </div>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                ยกเลิก
              </Button>
              <Button onClick={processImport} disabled={!file || isProcessing}>
                {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังทำงาน...</> : 'เริ่มนำเข้าข้อมูล'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}