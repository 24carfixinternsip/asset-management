import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftRight, Building2, User, Package, Tag, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductSerial, useAvailableSerials } from "@/hooks/useSerials";
import { UseMutationResult } from "@tanstack/react-query";

interface Employee {
  id: string;
  emp_code: string | null;
  name: string;
  nickname: string | null;
  image_url: string | null;
  departments?: {
    name: string;
  } | null;
}

// Department Type (ดึงจาก useDepartments hook structure)
interface Department {
  id: string;
  name: string;
  created_at?: string | null;
}

// Transaction Create Input
interface CreateTransactionInput {
  serial_id: string;
  employee_id?: string | null;
  department_id?: string | null;
  note?: string | null;
}

// Props Interface
interface BorrowTabProps {
  employees: Employee[] | undefined;
  departments: Department[] | undefined;
  createTransaction: UseMutationResult<any, Error, CreateTransactionInput, unknown>;
}

export function BorrowTab({ employees, departments, createTransaction }: BorrowTabProps) {
  const [borrowerType, setBorrowerType] = useState<'employee' | 'department'>('employee');
  const [borrowForm, setBorrowForm] = useState({ borrower_id: '', serial_id: '', note: '' });

  const [serialSearch, setSerialSearch] = useState('');
  const [debouncedSerialSearch, setDebouncedSerialSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSerialSearch(serialSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [serialSearch]);

  const { data: availableSerials } = useAvailableSerials(1, 50, debouncedSerialSearch);

  // Logic การแสดง Preview
  const selectedEmployee = useMemo(() => 
    employees?.find((e: Employee) => e.id === borrowForm.borrower_id), 
    [borrowForm.borrower_id, employees]
  );
  const selectedDepartment = useMemo(() => 
    departments?.find((d: Department) => d.id === borrowForm.borrower_id), 
    [borrowForm.borrower_id, departments]
  );
  const selectedSerial = useMemo(() => 
    availableSerials?.data?.find((s: ProductSerial) => s.id === borrowForm.serial_id), 
    [borrowForm.serial_id, availableSerials]
  );

  const handleBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // สร้าง input object ตามประเภทผู้ยืม
    const input: CreateTransactionInput = {
      serial_id: borrowForm.serial_id,
      note: borrowForm.note || null
    };
    
    // กำหนด employee_id หรือ department_id
    if (borrowerType === 'employee') {
      input.employee_id = borrowForm.borrower_id;
      input.department_id = null;
    } else {
      input.employee_id = null;
      input.department_id = borrowForm.borrower_id;
    }
    
    await createTransaction.mutateAsync(input);
    setBorrowForm({ borrower_id: '', serial_id: '', note: '' });
  };

  // Options (Part 1 & 2: ปรับปรุงการแสดงผลใน Dropdown)
  const employeeOptions = employees?.map((e: Employee) => ({ 
    value: e.id, 
    label: `${e.emp_code} : ${e.name}${e.nickname ? ` (${e.nickname})` : ''}` 
  })) || [];

  const departmentOptions = departments?.map((d: Department) => ({ 
    value: d.id, 
    label: d.name 
  })) || [];
  
  const serialOptions = availableSerials?.data?.map((s: ProductSerial) => {
    // ดึงยี่ห้อและรุ่นจาก products relation (ใช้ Optional Chaining เพื่อความปลอดภัย)
    const brand = s.products?.brand ? ` ${s.products.brand}` : '';
    const model = s.products?.model ? ` ${s.products.model}` : '';
    return { 
        value: s.id, 
        label: `${s.serial_code} : ${s.products?.name}${brand}${model}` 
    };
  }) || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Form */}
      <div className="lg:col-span-8 space-y-6">
        <Card className="border-t-4 border-t-primary shadow-md h-full">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" /> บันทึกการจ่ายทรัพย์สิน
            </CardTitle>
            <CardDescription>ระบุผู้รับผิดชอบและรายการทรัพย์สิน</CardDescription>
          </CardHeader>
          <CardContent>
            <form id="borrow-form" onSubmit={handleBorrow} className="space-y-6">
               <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                  <Label className="text-primary font-semibold flex items-center gap-2">
                    <User className="h-4 w-4" /> 1. ข้อมูลผู้เบิก
                  </Label>
                  <RadioGroup 
                    value={borrowerType} 
                    onValueChange={(v: any) => { setBorrowerType(v); setBorrowForm(prev => ({ ...prev, borrower_id: '' })) }} 
                    className="flex flex-wrap gap-4 sm:gap-6 mb-4"
                  >
                     <div className="flex items-center gap-2">
                        <RadioGroupItem value="employee" id="r-emp" />
                        <Label htmlFor="r-emp" className="cursor-pointer flex items-center gap-1">พนักงาน</Label>
                     </div>
                     <div className="flex items-center gap-2">
                        <RadioGroupItem value="department" id="r-dept" />
                        <Label htmlFor="r-dept" className="cursor-pointer flex items-center gap-1">แผนก</Label>
                     </div>
                  </RadioGroup>
                  <SearchableSelect 
                    items={borrowerType === 'employee' ? employeeOptions : departmentOptions} 
                    value={borrowForm.borrower_id} 
                    onValueChange={(v) => setBorrowForm(prev => ({ ...prev, borrower_id: v }))} 
                    placeholder={borrowerType === 'employee' ? "ค้นหาชื่อ / รหัส / ชื่อเล่น..." : "ค้นหาแผนก..."} 
                  />
               </div>

               <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                  <Label className="text-primary font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" /> 2. ข้อมูลทรัพย์สิน
                  </Label>
                  <SearchableSelect 
                    items={serialOptions} 
                    value={borrowForm.serial_id} 
                    onValueChange={(v) => setBorrowForm(prev => ({ ...prev, serial_id: v }))} 
                    searchValue={serialSearch}
                    onSearchChange={setSerialSearch}
                    placeholder="ค้นหา Serial / ชื่อสินค้า / ยี่ห้อ..." 
                  />
                  <div className="pt-2">
                    <Label>หมายเหตุ</Label>
                    <Input 
                        value={borrowForm.note} 
                        onChange={(e) => setBorrowForm(prev => ({ ...prev, note: e.target.value }))} 
                        placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)..." 
                    />
                  </div>
               </div>
            </form>
          </CardContent>
          <CardFooter className="justify-end gap-3 bg-muted/10 p-4 rounded-b-lg">
             <Button variant="outline" onClick={() => setBorrowForm({ borrower_id: '', serial_id: '', note: '' })}>
                ล้างข้อมูล
             </Button>
             <Button 
                type="submit" 
                form="borrow-form" 
                disabled={!borrowForm.borrower_id || !borrowForm.serial_id || createTransaction.isPending} 
                className="min-w-[140px] gap-2 shadow-sm"
             >
                <ArrowLeftRight className="h-4 w-4" /> 
                {createTransaction.isPending ? 'กำลังบันทึก...' : 'ยืนยันการเบิก'}
             </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Right: Preview (Part 3: ปรับปรุงรายละเอียดและการจัดวาง) */}
      <div className="lg:col-span-4 flex flex-col gap-6">
         {/* User Preview Card */}
         <Card className={cn(
             "transition-all shadow-sm flex flex-col", 
             borrowForm.borrower_id ? "opacity-100 ring-2 ring-primary/20" : "opacity-60 grayscale-[0.5]"
         )}>
            <CardHeader className="pb-3 bg-muted/20 border-b">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center gap-2">
                    <User className="h-4 w-4" /> ผู้รับผิดชอบ
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 flex flex-col items-center text-center p-6">
               {borrowerType === 'employee' && selectedEmployee ? (
                  <>
                    <Avatar className="h-24 w-24 mb-3 border-4 border-background shadow-md">
                        <AvatarImage src={selectedEmployee.image_url || undefined} />
                        <AvatarFallback className="text-lg bg-primary/10 text-primary">
                            {selectedEmployee.name.substring(0,2)}
                        </AvatarFallback>
                    </Avatar>
                    
                    {/* ชื่อและชื่อเล่น */}
                    <h3 className="font-bold text-lg leading-tight break-words px-2">
                        {selectedEmployee.name}
                    </h3>
                    {selectedEmployee.nickname && (
                        <p className="text-muted-foreground font-medium text-sm mt-1">
                            ( {selectedEmployee.nickname} )
                        </p>
                    )}

                    <div className="mt-4 space-y-2 w-full">
                        <Badge variant="outline" className="w-full justify-center py-1 bg-background">
                            {selectedEmployee.emp_code}
                        </Badge>
                        <Badge variant="secondary" className="w-full justify-center py-1">
                            {selectedEmployee.departments?.name || '-'}
                        </Badge>
                    </div>
                  </>
               ) : borrowerType === 'department' && selectedDepartment ? (
                  <>
                    <div className="h-24 w-24 rounded-full bg-blue-50 flex items-center justify-center mb-4 border-4 border-background shadow-sm">
                        <Building2 className="h-10 w-10 text-blue-500" />
                    </div>
                    <h3 className="font-bold text-lg break-words">{selectedDepartment.name}</h3>
                    <Badge variant="outline" className="mt-2 text-blue-600 bg-blue-50 px-4">แผนก</Badge>
                  </>
               ) : (
                   <div className="py-8 text-muted-foreground/40 text-center flex flex-col items-center">
                       <User className="h-12 w-12 mb-2 opacity-50" />
                       <p className="text-sm">กรุณาเลือกผู้เบิก</p>
                   </div>
               )}
            </CardContent>
         </Card>

         {/* Asset Preview Card */}
         <Card className={cn(
             "transition-all shadow-sm flex flex-col", 
             borrowForm.serial_id ? "opacity-100 ring-2 ring-primary/20" : "opacity-60 grayscale-[0.5]"
         )}>
            <CardHeader className="pb-3 bg-muted/20 border-b">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center gap-2">
                    <Package className="h-4 w-4" /> ทรัพย์สิน
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 flex flex-col items-center text-center p-6">
               {selectedSerial ? (
                  <>
                    <div className="w-full aspect-video bg-muted/10 rounded-lg mb-4 flex items-center justify-center border overflow-hidden relative group">
                        {selectedSerial.products?.image_url ? (
                            <img src={selectedSerial.products.image_url} className="h-full w-full object-contain p-2" alt="Product" />
                        ) : (
                            <Package className="h-12 w-12 text-muted-foreground/30" />
                        )}
                    </div>
                    
                    {/* ชื่อสินค้า */}
                    <h3 className="font-bold text-lg leading-tight line-clamp-2 break-words w-full" title={selectedSerial.products?.name}>
                        {selectedSerial.products?.name}
                    </h3>
                    
                    {/* ยี่ห้อและรุ่น */}
                    {(selectedSerial.products?.brand || selectedSerial.products?.model) && (
                        <div className="flex flex-wrap gap-2 justify-center mt-2 text-sm text-muted-foreground">
                            {selectedSerial.products?.brand && (
                                <span className="flex items-center gap-1 bg-secondary/50 px-2 py-0.5 rounded text-xs">
                                    <ShieldCheck className="w-3 h-3" /> {selectedSerial.products.brand}
                                </span>
                            )}
                            {selectedSerial.products?.model && (
                                <span className="flex items-center gap-1 bg-secondary/50 px-2 py-0.5 rounded text-xs">
                                    <Tag className="w-3 h-3" /> {selectedSerial.products.model}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="mt-4 w-full">
                         <div className="bg-primary/5 border border-primary/10 rounded px-3 py-2 flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Serial No.</span>
                            <span className="font-mono text-sm font-bold text-primary">
                                {selectedSerial.serial_code}
                            </span>
                         </div>
                    </div>
                  </>
               ) : (
                   <div className="py-8 text-muted-foreground/40 text-center flex flex-col items-center">
                       <Package className="h-12 w-12 mb-2 opacity-50" />
                       <p className="text-sm">กรุณาเลือกทรัพย์สิน</p>
                   </div>
               )}
            </CardContent>
         </Card>
      </div>
    </div>
  );
}