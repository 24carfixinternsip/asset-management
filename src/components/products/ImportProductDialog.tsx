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

export function ImportProductDialog({ open, onOpenChange, onSuccess }: ImportProductDialogProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);
  
  // State สำหรับเก็บหมวดหมู่จาก DB
  const [dbCategories, setDbCategories] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setFile(null);
      setResult(null);
      setProgress(0);
      setIsProcessing(false);
      setStatusMessage("");
      fetchCategories(); // ดึงหมวดหมู่ล่าสุดทุกครั้งที่เปิด Dialog
    }
  }, [open]);

  // ฟังก์ชันดึงหมวดหมู่จาก Database
  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('name')
        .order('name');
      
      if (!error && data) {
        setDbCategories(data.map(c => c.name));
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

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

  // Logic การจับคู่หมวดหมู่ที่ฉลาดขึ้นและใช้ข้อมูลจริงจาก DB
  const resolveCategory = (input: string, availableCategories: string[]): string => {
    const cleanInput = input?.trim().toUpperCase() || "";
    if (!cleanInput) return availableCategories[0] || "General";

    // 1. ลองหาที่ตรงกันเป๊ะๆ หรือตรงกับ Code ในวงเล็บ
    const found = availableCategories.find(sysCat => {
      const match = sysCat.match(/\(([^)]+)\)/);
      const code = match ? match[1].toUpperCase() : "";
      return code === cleanInput || sysCat.toUpperCase() === cleanInput || sysCat.toUpperCase().includes(cleanInput);
    });

    // 2. ถ้าเจอให้ใช้ตัวนั้น ถ้าไม่เจอให้ลองหาตัวแรกสุด หรือ Default
    return found || availableCategories[0] || "General"; 
  };

  // Logic การหา Prefix ที่ปลอดภัยขึ้น (รองรับกรณีไม่มีวงเล็บ)
  const getPrefixFromFullCategory = (fullCategory: string) => {
    // 1. ลองดึงจากในวงเล็บ (CODE)
    const match = fullCategory.match(/\(([^)]+)\)/);
    if (match) return match[1].toUpperCase();

    // 2. ถ้าไม่มีวงเล็บ ให้ใช้ 2 ตัวอักษรแรกภาษาอังกฤษ
    // ลบภาษาไทยและอักขระพิเศษออกก่อน
    const englishOnly = fullCategory.replace(/[^a-zA-Z0-9]/g, '');
    if (englishOnly.length >= 2) {
      return englishOnly.substring(0, 2).toUpperCase();
    }

    // 3. ถ้าไม่ไหวจริงๆ ให้ใช้ GEN (General)
    return "GEN";
  };

  const fetchLastIds = async (categories: string[]) => {
    const prefixes = [...new Set(categories.map(c => getPrefixFromFullCategory(c)))];
    const lastIds: Record<string, number> = {};

    for (const prefix of prefixes) {
      // ค้นหา SKU ล่าสุดของ Prefix นี้จากฐานข้อมูล
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

    // ใช้ dbCategories ที่โหลดมาแล้ว ถ้ายังไม่มีให้โหลดใหม่ (Safe check)
    let currentCategories = dbCategories;
    if (currentCategories.length === 0) {
       const { data } = await supabase.from('categories').select('name');
       if (data) currentCategories = data.map(c => c.name);
    }

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        const total = rows.length;

        setStatusMessage("กำลังวิเคราะห์ข้อมูล...");
        
        // Resolve หมวดหมู่ทั้งหมดก่อน เพื่อเตรียมหา Running Number
        const allCategories = rows.map(r => resolveCategory(r.category || '', currentCategories));
        const runningNumbers = await fetchLastIds(allCategories);

        const preparedRows = rows.map((row) => {
           // ใช้ resolveCategory เวอร์ชันใหม่ที่รับ dynamic list
           const category = resolveCategory(row.category, currentCategories);
           const prefix = getPrefixFromFullCategory(category);
           
           let p_id = row.p_id || row.id || row.code;
           
           // Auto Generate SKU ถ้าไม่มีใน CSV
           if (!p_id) {
              if (!runningNumbers[prefix]) runningNumbers[prefix] = 0;
              runningNumbers[prefix] += 1;
              p_id = `${prefix}-${String(runningNumbers[prefix]).padStart(4, '0')}`;
           }
           
           return {
             p_id: p_id,
             name: row.name || row.product_name,
             category: category,
             brand: row.brand || '',
             model: row.model || '',
             price: parseFloat(row.price) || 0,
             unit: row.unit || 'ชิ้น',
             description: row.description || '',
             notes: row.notes || '',
             stock_total: parseInt(row.quantity || row.qty || '0') || 0,
             image_url: row.image_url || null
           };
        }).filter(r => r.name);

        // Batch Process (คงเดิม)
        const CHUNK_SIZE = 50;
        let successTotal = 0;
        let allErrors: string[] = [];

        for (let i = 0; i < preparedRows.length; i += CHUNK_SIZE) {
          const chunk = preparedRows.slice(i, i + CHUNK_SIZE);
          setStatusMessage(`กำลังบันทึกกลุ่มข้อมูลที่ ${i + 1} - ${Math.min(i + CHUNK_SIZE, preparedRows.length)}...`);

          // เรียกใช้ RPC import_products_bulk
          const { data, error } = await supabase.rpc('import_products_bulk', { 
            products_data: chunk 
          });

          if (error) {
            console.error('Batch Import Error:', error);
            allErrors.push(`Batch ${i}: ${error.message}`);
          } else {
            // @ts-ignore
            successTotal += (data?.success_count || 0);
            // @ts-ignore
            if (data?.errors && data.errors.length > 0) {
               // @ts-ignore
               allErrors = [...allErrors, ...data.errors];
            }
          }
          
          setProgress(Math.round(((i + CHUNK_SIZE) / total) * 100));
        }

        setIsProcessing(false);
        setResult({ success: successTotal, errors: allErrors });
        setStatusMessage("เสร็จสิ้น!");
        
        if (successTotal > 0) {
          queryClient.invalidateQueries({ queryKey: ['products'] });
          queryClient.invalidateQueries({ queryKey: ['serials'] }); // อัปเดต Serials ด้วย
          toast.success(`นำเข้าสำเร็จ ${successTotal} รายการ`);
          onSuccess();
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