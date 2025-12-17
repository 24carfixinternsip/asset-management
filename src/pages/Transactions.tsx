import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; 
import { SearchableSelect } from "@/components/ui/searchable-select"; 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeftRight, RotateCcw, Building2, User, 
  Clock, Package, CheckCircle2, AlertTriangle, Search, Filter, X, Eye, FileText, CalendarDays
} from "lucide-react";
import { 
  useTransactions, 
  useCreateTransaction, 
  useReturnTransaction,
  Transaction
} from "@/hooks/useTransactions";
import { useAvailableSerials } from "@/hooks/useSerials";
import { useEmployees, useDepartments } from "@/hooks/useMasterData";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function Transactions() {
  const { data: activeTransactions, isLoading: activeLoading } = useTransactions('Active');
  const { data: completedTransactions, isLoading: completedLoading } = useTransactions('Completed');
  const { data: availableSerials } = useAvailableSerials();
  const { data: employees } = useEmployees();
  const { data: departments } = useDepartments(); 
  
  const createTransaction = useCreateTransaction();
  const returnTransaction = useReturnTransaction();

  // --- States for Borrow ---
  const [borrowerType, setBorrowerType] = useState<'employee' | 'department'>('employee');
  const [borrowForm, setBorrowForm] = useState({
    borrower_id: '',
    serial_id: '',
    note: '',
  });

  // --- States for Filter Active Loans ---
  const [filterType, setFilterType] = useState<'all' | 'employee' | 'department'>('all');
  const [filterId, setFilterId] = useState<string>(''); 
  const [activeSearch, setActiveSearch] = useState("");

  // --- States for Return & View ---
  const [returnDialog, setReturnDialog] = useState<{ open: boolean; tx: Transaction | null }>({
    open: false,
    tx: null
  });
  const [viewDialog, setViewDialog] = useState<{ open: boolean; tx: Transaction | null }>({
    open: false,
    tx: null
  });
  
  const [returnCondition, setReturnCondition] = useState('ปกติ');
  const [returnNote, setReturnNote] = useState('');

  // --- Derived Data for Preview ---
  const selectedEmployee = useMemo(() => 
    employees?.find(e => e.id === borrowForm.borrower_id), 
  [borrowForm.borrower_id, employees]);

  const selectedDepartment = useMemo(() => 
    departments?.find(d => d.id === borrowForm.borrower_id), 
  [borrowForm.borrower_id, departments]);

  const selectedSerial = useMemo(() => 
    availableSerials?.find(s => s.id === borrowForm.serial_id), 
  [borrowForm.serial_id, availableSerials]);

  // --- Filter Logic ---
  const filteredActiveTransactions = useMemo(() => {
    if (!activeTransactions) return [];
    
    return activeTransactions.filter(tx => {
      let matchesEntity = true;
      if (filterType === 'employee' && filterId) {
        matchesEntity = tx.employee_id === filterId;
      } else if (filterType === 'department' && filterId) {
        const isDirectBorrow = tx.department_id === filterId;
        const isEmployeeBorrow = tx.employees?.department_id === filterId;
        matchesEntity = isDirectBorrow || isEmployeeBorrow;
      }

      let matchesSearch = true;
      if (activeSearch) {
        const lowerSearch = activeSearch.toLowerCase();
        const serial = tx.product_serials?.serial_code?.toLowerCase() || '';
        const productName = tx.product_serials?.products?.name?.toLowerCase() || '';
        matchesSearch = serial.includes(lowerSearch) || productName.includes(lowerSearch);
      }
      
      return matchesEntity && matchesSearch;
    });
  }, [activeTransactions, filterType, filterId, activeSearch]);

  // --- Handlers ---
  const handleBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: {
      serial_id: string;
      note?: string;
      employee_id?: string;
      department_id?: string;
    } = {
      serial_id: borrowForm.serial_id,
      note: borrowForm.note || undefined,
    };
    if (borrowerType === 'employee') {
      payload.employee_id = borrowForm.borrower_id;
    } else {
      payload.department_id = borrowForm.borrower_id;
    }
    await createTransaction.mutateAsync(payload);
    setBorrowForm({ borrower_id: '', serial_id: '', note: '' });
  };

  const openReturnDialog = (tx: Transaction) => {
    setReturnDialog({ open: true, tx });
    setReturnCondition('ปกติ');
    setReturnNote('');
  };

  const confirmReturn = async () => {
    if (!returnDialog.tx) return;
    await returnTransaction.mutateAsync({ 
      transactionId: returnDialog.tx.id, 
      serialId: returnDialog.tx.serial_id 
    });
    setReturnDialog({ open: false, tx: null });
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'd MMM yy HH:mm', { locale: th });
  };

  // --- Options ---
  const employeeOptions = employees?.map(emp => ({
    value: emp.id,
    label: `${emp.emp_code} : ${emp.name}`
  })) || [];

  const departmentOptions = departments?.map(dept => ({
    value: dept.id,
    label: dept.name 
  })) || [];

  const serialOptions = availableSerials?.map(serial => {
    const brand = serial.products?.brand ? ` ${serial.products.brand}` : '';
    const model = serial.products?.model ? ` ${serial.products.model}` : '';
    const fullProductName = `${serial.products?.name}${brand}${model}`;
    
    return {
      value: serial.id,
      label: `${serial.serial_code} : ${fullProductName}`
    };
  }) || [];

  return (
    <MainLayout title="ระบบเบิก-จ่ายและคืนทรัพย์สิน">
      <div className="space-y-6">
        <Tabs defaultValue="borrow" className="space-y-6">
          <div className="flex items-center justify-between overflow-x-auto pb-2 sm:pb-0">
            <TabsList className="grid w-full min-w-[300px] max-w-[400px] grid-cols-3">
              <TabsTrigger value="borrow">ทำรายการเบิก</TabsTrigger>
              <TabsTrigger value="active">รายการถูกยืม</TabsTrigger>
              <TabsTrigger value="history">ประวัติย้อนหลัง</TabsTrigger>
            </TabsList>
          </div>

          {/* ================= BORROW TAB ================= */}
          <TabsContent value="borrow" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Form */}
              <div className="lg:col-span-8 space-y-6">
                <Card className="border-t-4 border-t-primary shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ArrowLeftRight className="h-5 w-5 text-primary" />
                      บันทึกการจ่ายทรัพย์สิน (Check-out)
                    </CardTitle>
                    <CardDescription>
                      ระบุผู้รับผิดชอบและรายการทรัพย์สินเพื่อทำการบันทึกเข้าระบบ
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form id="borrow-form" onSubmit={handleBorrow} className="space-y-6">
                      
                      {/* 1. Borrower */}
                      <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                        <Label className="text-primary font-semibold text-base">1. ข้อมูลผู้เบิก</Label>
                        <RadioGroup 
                          defaultValue="employee" 
                          value={borrowerType}
                          onValueChange={(val) => {
                            setBorrowerType(val as 'employee' | 'department');
                            setBorrowForm(prev => ({ ...prev, borrower_id: '' }));
                          }}
                          className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="employee" id="r-employee" />
                            <Label htmlFor="r-employee" className="cursor-pointer flex items-center gap-2 font-normal">
                              <User className="h-4 w-4 text-muted-foreground" /> พนักงาน (Individual)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="department" id="r-department" />
                            <Label htmlFor="r-department" className="cursor-pointer flex items-center gap-2 font-normal">
                              <Building2 className="h-4 w-4 text-muted-foreground" /> แผนก (Department)
                            </Label>
                          </div>
                        </RadioGroup>

                        <div className="space-y-2">
                          <SearchableSelect
                            items={borrowerType === 'employee' ? employeeOptions : departmentOptions}
                            value={borrowForm.borrower_id}
                            onValueChange={(value) => setBorrowForm(prev => ({ ...prev, borrower_id: value }))}
                            placeholder={borrowerType === 'employee' ? "ชื่อ / รหัสพนักงาน" : "ค้นหา: ชื่อแผนก..."}
                            emptyMessage="ไม่พบข้อมูล"
                          />
                        </div>
                      </div>

                      {/* 2. Asset */}
                      <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                        <Label className="text-primary font-semibold text-base">2. ข้อมูลทรัพย์สิน</Label>
                        <div className="space-y-2">
                          <SearchableSelect
                            items={serialOptions}
                            value={borrowForm.serial_id}
                            onValueChange={(value) => setBorrowForm(prev => ({ ...prev, serial_id: value }))}
                            placeholder="ชื่อสินค้า / Serial Number"
                            emptyMessage="ไม่พบรายการ หรือรายการไม่ว่าง"
                          />
                          <p className="text-[11px] text-muted-foreground pl-1">
                            * เลือกทรัพย์สินที่ต้องการเบิกออกจากคลัง
                          </p>
                        </div>
                        
                        <div className="space-y-2 pt-2">
                          <Label className="font-normal">หมายเหตุ / Project Reference</Label>
                          <Input 
                            placeholder="ใช้สำหรับห้องคอลเซ็นเตอร์" 
                            value={borrowForm.note}
                            onChange={(e) => setBorrowForm(prev => ({ ...prev, note: e.target.value }))}
                          />
                        </div>
                      </div>

                    </form>
                  </CardContent>
                  <CardFooter className="flex flex-col-reverse sm:flex-row justify-end gap-3 border-t bg-muted/10 p-4">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => setBorrowForm({ borrower_id: '', serial_id: '', note: '' })}>
                      ล้างข้อมูล
                    </Button>
                    <Button 
                      type="submit" form="borrow-form"
                      disabled={!borrowForm.borrower_id || !borrowForm.serial_id || createTransaction.isPending}
                      className="w-full sm:w-auto min-w-[140px] gap-2 shadow-md"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                      {createTransaction.isPending ? 'กำลังประมวลผล...' : 'ยืนยันการเบิก'}
                    </Button>
                  </CardFooter>
                </Card>
              </div>

              {/* Right Column: Preview */}
              <div className="lg:col-span-4 space-y-6">
                <Card className={cn("transition-all duration-300", borrowForm.borrower_id ? "opacity-100" : "opacity-50 grayscale")}>
                  <CardHeader className="pb-3 bg-muted/20">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">ผู้รับผิดชอบ</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 flex flex-col items-center text-center">
                    {borrowerType === 'employee' && selectedEmployee ? (
                      <>
                        <Avatar className="h-24 w-24 border-4 border-white shadow-sm mb-4">
                          <AvatarImage src={selectedEmployee.image_url || undefined} />
                          <AvatarFallback className="text-2xl bg-primary/10 text-primary">{selectedEmployee.name.substring(0,2)}</AvatarFallback>
                        </Avatar>
                        <h3 className="font-bold text-lg text-foreground line-clamp-1 break-all px-2">{selectedEmployee.name}</h3>
                        <p className="text-sm text-muted-foreground">{selectedEmployee.emp_code}</p>
                        <Badge variant="secondary" className="mt-2 line-clamp-1">{selectedEmployee.departments?.name || 'ไม่ระบุแผนก'}</Badge>
                      </>
                    ) : borrowerType === 'department' && selectedDepartment ? (
                      <>
                        <div className="h-24 w-24 rounded-full bg-blue-50 flex items-center justify-center mb-4 border-4 border-white shadow-sm">
                          <Building2 className="h-10 w-10 text-blue-500" />
                        </div>
                        <h3 className="font-bold text-lg text-foreground line-clamp-1 px-2">{selectedDepartment.name}</h3>
                        <Badge variant="outline" className="mt-2 text-blue-600 bg-blue-50 border-blue-100">เบิกใช้งานส่วนกลาง</Badge>
                      </>
                    ) : (
                      <div className="py-8 flex flex-col items-center text-muted-foreground/40">
                        <User className="h-12 w-12 mb-2" />
                        <p className="text-sm">กรุณาเลือกผู้เบิก</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className={cn("transition-all duration-300", borrowForm.serial_id ? "opacity-100" : "opacity-50 grayscale")}>
                  <CardHeader className="pb-3 bg-muted/20">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">ทรัพย์สินที่เลือก</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 flex flex-col items-center text-center">
                    {selectedSerial ? (
                      <>
                        <div className="w-full aspect-video bg-muted/10 rounded-lg mb-4 flex items-center justify-center overflow-hidden border">
                          {selectedSerial.products?.image_url ? (
                            <img src={selectedSerial.products.image_url} className="w-full h-full object-contain" />
                          ) : (
                            <Package className="h-12 w-12 text-muted-foreground/30" />
                          )}
                        </div>
                        <h3 className="font-bold text-lg text-foreground line-clamp-2 px-2">{selectedSerial.products?.name}</h3>
                        <p className="font-mono text-sm text-primary font-semibold bg-primary/5 px-2 py-0.5 rounded mt-1">{selectedSerial.serial_code}</p>
                        <div className="flex flex-wrap justify-center gap-2 mt-3 text-xs text-muted-foreground">
                          <span className="truncate max-w-[120px]">ยี่ห้อ: {selectedSerial.products?.brand || '-'}</span>
                          <span className="truncate max-w-[120px]">รุ่น: {selectedSerial.products?.model || '-'}</span>
                        </div>
                      </>
                    ) : (
                      <div className="py-8 flex flex-col items-center text-muted-foreground/40">
                        <Package className="h-12 w-12 mb-2" />
                        <p className="text-sm">กรุณาเลือกทรัพย์สิน</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ================= ACTIVE TAB ================= */}
          <TabsContent value="active">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Clock className="h-5 w-5 text-warning shrink-0" />
                      รายการที่กำลังถูกยืม
                    </CardTitle>
                    <CardDescription className="mt-1 line-clamp-1">
                        {filterType !== 'all' 
                            ? `Filter: ${filterType === 'employee' ? 'รายบุคคล' : 'รายแผนก (รวมสังกัด)'}` 
                            : 'แสดงรายการค้างคืนทั้งหมดในระบบ'}
                    </CardDescription>
                  </div>
                  
                  {/* Filters - Responsive Grid */}
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full xl:w-auto">
                    <div className="w-full sm:w-[130px]">
                      <Select 
                        value={filterType} 
                        onValueChange={(val) => { 
                          const nextFilter = val as 'all' | 'employee' | 'department';
                          setFilterType(nextFilter); 
                          setFilterId(''); 
                        }}
                      >
                          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="ประเภท" /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">ทั้งหมด</SelectItem>
                              <SelectItem value="employee">รายบุคคล</SelectItem>
                              <SelectItem value="department">รายแผนก</SelectItem>
                          </SelectContent>
                      </Select>
                    </div>
                    
                    <div className={cn("w-full sm:w-[200px] transition-opacity duration-200", filterType === 'all' ? "opacity-50 pointer-events-none grayscale" : "opacity-100")}>
                        <SearchableSelect
                            items={filterType === 'employee' ? employeeOptions : departmentOptions}
                            value={filterId}
                            onValueChange={setFilterId}
                            placeholder={filterType === 'employee' ? "เลือกพนักงาน..." : "เลือกแผนก..."}
                            searchPlaceholder="ค้นหา..."
                            disabled={filterType === 'all'}
                        />
                    </div>
                    
                    <div className="relative col-span-2 sm:col-span-1 sm:w-[180px] w-full">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="ค้นหา Serial / สินค้า..."
                            className="pl-8 h-9 text-sm w-full"
                            value={activeSearch}
                            onChange={(e) => setActiveSearch(e.target.value)}
                        />
                        {activeSearch && <button onClick={() => setActiveSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-0 border-t">
                {activeLoading ? (
                  <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : filteredActiveTransactions && filteredActiveTransactions.length > 0 ? (
                  <ScrollArea className="h-[500px] w-full">
                    <div className="min-w-[800px] md:min-w-0"> {/* Ensure table has width to scroll on mobile */}
                        <Table>
                        <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                            <TableRow>
                            <TableHead className="w-[120px] sm:w-[150px]">Serial No.</TableHead>
                            <TableHead className="min-w-[200px]">รายละเอียดสินค้า</TableHead>
                            <TableHead className="min-w-[150px]">ผู้ยืม / แผนก</TableHead>
                            <TableHead className="w-[120px]">วันที่ยืม</TableHead>
                            <TableHead className="text-right w-[140px] sticky right-0 bg-card shadow-[-2px_0px_5px_rgba(0,0,0,0.05)] sm:shadow-none">จัดการ</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredActiveTransactions.map((tx) => (
                            <TableRow key={tx.id}>
                                <TableCell className="font-mono font-medium text-primary text-xs truncate">{tx.product_serials?.serial_code}</TableCell>
                                <TableCell>
                                <div className="flex flex-col max-w-[200px] sm:max-w-xs">
                                    <span className="font-medium text-sm truncate" title={tx.product_serials?.products?.name}>{tx.product_serials?.products?.name}</span>
                                    <span className="text-xs text-muted-foreground truncate">
                                    {[tx.product_serials?.products?.brand, tx.product_serials?.products?.model].filter(Boolean).join(' ')}
                                    </span>
                                </div>
                                </TableCell>
                                <TableCell>
                                {tx.employees ? (
                                    <div className="flex items-center gap-2 max-w-[180px]">
                                    <Avatar className="h-6 w-6 hidden sm:block">
                                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{tx.employees.name.substring(0,2)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-medium truncate" title={tx.employees.name}>{tx.employees.name}</span>
                                        {filterType === 'department' && tx.employees.department_id === filterId && (
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1 truncate"><CheckCircle2 className="h-3 w-3 text-green-500" /> สังกัดแผนกนี้</span>
                                        )}
                                    </div>
                                    </div>
                                ) : tx.departments ? (
                                    <div className="flex items-center gap-2 max-w-[180px]">
                                    <div className="h-6 w-6 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0">
                                        <Building2 className="h-3 w-3 text-blue-500" />
                                    </div>
                                    <span className="text-sm font-medium text-blue-700 truncate" title={tx.departments.name}>{tx.departments.name}</span>
                                    </div>
                                ) : '-'}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(tx.borrow_date)}</TableCell>
                                <TableCell className="text-right sticky right-0 bg-background/95 sm:bg-transparent shadow-[-2px_0px_5px_rgba(0,0,0,0.05)] sm:shadow-none">
                                <div className="flex justify-end gap-2">
                                    <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600"
                                    onClick={() => setViewDialog({ open: true, tx })}
                                    >
                                    <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-8 px-2 gap-1 border-primary/20 text-primary hover:bg-primary/5 hover:text-primary"
                                    onClick={() => openReturnDialog(tx)}
                                    >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">รับคืน</span>
                                    </Button>
                                </div>
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/5">
                    <CheckCircle2 className="h-16 w-16 mb-4 text-green-500/20" />
                    <p className="font-medium">ไม่พบรายการค้างคืน</p>
                    <p className="text-sm opacity-70">ลองปรับตัวกรอง หรือค้นหาใหม่</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================= HISTORY TAB ================= */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>ประวัติการเบิก-คืนย้อนหลัง</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {completedLoading ? (
                  <div className="p-4 space-y-3"><Skeleton className="h-12 w-full" /></div>
                ) : (
                  <ScrollArea className="h-[600px] w-full">
                     <div className="min-w-[800px] md:min-w-0">
                        <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                            <TableRow>
                            <TableHead className="w-[120px]">Serial No.</TableHead>
                            <TableHead className="min-w-[200px]">สินค้า</TableHead>
                            <TableHead className="min-w-[150px]">ผู้ยืม</TableHead>
                            <TableHead className="min-w-[150px]">ช่วงเวลาการยืม</TableHead>
                            <TableHead className="w-[100px]">สถานะ</TableHead>
                            <TableHead className="text-right w-[60px] sticky right-0 bg-card">ดู</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {completedTransactions?.map((tx) => (
                            <TableRow key={tx.id}>
                                <TableCell className="font-mono text-xs truncate">{tx.product_serials?.serial_code}</TableCell>
                                <TableCell>
                                <div className="flex flex-col max-w-[200px]">
                                    <span className="font-medium text-sm truncate" title={tx.product_serials?.products?.name}>{tx.product_serials?.products?.name}</span>
                                    <span className="text-xs text-muted-foreground truncate">{[tx.product_serials?.products?.brand, tx.product_serials?.products?.model].filter(Boolean).join(' ')}</span>
                                </div>
                                </TableCell>
                                <TableCell className="text-sm">
                                    <div className="truncate max-w-[150px]" title={tx.employees?.name || tx.departments?.name}>
                                        {tx.employees?.name || tx.departments?.name || '-'}
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                <div>ยืม: {formatDate(tx.borrow_date)}</div>
                                <div className="text-emerald-600">คืน: {tx.return_date ? formatDate(tx.return_date) : '-'}</div>
                                </TableCell>
                                <TableCell><StatusBadge status="Completed" /></TableCell>
                                <TableCell className="text-right sticky right-0 bg-background/95 sm:bg-transparent">
                                    <Button 
                                        size="sm" variant="ghost" className="h-8 w-8 p-0"
                                        onClick={() => setViewDialog({ open: true, tx })}
                                    >
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* --- View Detail Dialog --- */}
      <Dialog open={viewDialog.open} onOpenChange={(open) => !open && setViewDialog({ open: false, tx: null })}>
        <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden w-[95vw] rounded-lg">
          <DialogHeader className="p-4 sm:p-6 pb-2 bg-muted/10 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="truncate">รายละเอียดการเบิก</DialogTitle>
                <DialogDescription className="truncate">Transaction ID: {viewDialog.tx?.id.substring(0, 8)}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          {viewDialog.tx && (
            <div className="flex flex-col sm:flex-row h-full max-h-[70vh] overflow-y-auto sm:overflow-hidden">
              {/* Left Side: Images */}
              <div className="w-full sm:w-[240px] bg-muted/20 border-b sm:border-r p-6 flex flex-col gap-4 items-center justify-center text-center shrink-0">
                <div className="w-32 h-32 sm:w-full sm:aspect-square bg-white rounded-lg border shadow-sm p-2 flex items-center justify-center overflow-hidden">
                  {viewDialog.tx.product_serials?.products?.image_url ? (
                    <img 
                      src={viewDialog.tx.product_serials.products.image_url} 
                      className="w-full h-full object-contain" 
                      alt="Product" 
                    />
                  ) : (
                    <div className="text-muted-foreground/30 flex flex-col items-center">
                      <Package className="h-12 w-12 mb-2" />
                      <span className="text-xs">ไม่มีรูปสินค้า</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground w-full">
                  <div className="font-medium mb-1">สถานะปัจจุบัน</div>
                  <StatusBadge status={viewDialog.tx.status} className="w-full justify-center" />
                </div>
              </div>

              {/* Right Side: Info */}
              <div className="flex-1 p-6 overflow-y-auto">
                <div className="space-y-6">
                  
                  {/* สินค้า */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                      <Package className="h-4 w-4" /> ข้อมูลทรัพย์สิน
                    </h4>
                    <div className="space-y-3 pl-2 border-l-2 border-primary/20">
                      <div>
                        <span className="text-xs text-muted-foreground block">ชื่อสินค้า</span>
                        <span className="font-medium text-base break-words">{viewDialog.tx.product_serials?.products?.name}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs text-muted-foreground block">Serial Number</span>
                          <span className="font-mono text-sm bg-muted px-1 rounded inline-block">{viewDialog.tx.product_serials?.serial_code}</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">ยี่ห้อ / รุ่น</span>
                          <span className="text-sm break-words">
                            {[viewDialog.tx.product_serials?.products?.brand, viewDialog.tx.product_serials?.products?.model].filter(Boolean).join(' / ') || '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ผู้เบิก */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                      <User className="h-4 w-4" /> ข้อมูลผู้เบิก
                    </h4>
                    <div className="flex items-center gap-3 pl-2">
                        <Avatar className="h-10 w-10 border shrink-0">
                            <AvatarFallback>{(viewDialog.tx.employees?.name || viewDialog.tx.departments?.name)?.substring(0,2)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <div className="font-medium truncate">{viewDialog.tx.employees?.name || viewDialog.tx.departments?.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                                {viewDialog.tx.employees ? `รหัส: ${viewDialog.tx.employees.emp_code}` : 'เบิกในนามแผนก'}
                            </div>
                        </div>
                    </div>
                  </div>

                  {/* วันที่และหมายเหตุ */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" /> รายละเอียดการเบิก
                    </h4>
                    <div className="grid grid-cols-2 gap-4 pl-2 mb-3">
                        <div>
                            <span className="text-xs text-muted-foreground block">วันที่ยืม</span>
                            <span className="text-sm">{formatDate(viewDialog.tx.borrow_date)}</span>
                        </div>
                        <div>
                            <span className="text-xs text-muted-foreground block">วันที่คืน</span>
                            <span className={cn("text-sm", viewDialog.tx.return_date ? "text-emerald-600" : "text-muted-foreground")}>
                                {viewDialog.tx.return_date ? formatDate(viewDialog.tx.return_date) : 'ยังไม่คืน'}
                            </span>
                        </div>
                    </div>
                    {viewDialog.tx.note && (
                        <div className="bg-yellow-50 p-3 rounded-md text-sm border border-yellow-100 break-words">
                            <span className="font-medium text-yellow-800 text-xs mb-1 block">หมายเหตุ:</span>
                            <span className="text-yellow-900/80">{viewDialog.tx.note}</span>
                        </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          )}
          <DialogFooter className="p-4 bg-muted/10 border-t">
            <Button className="w-full sm:w-auto" onClick={() => setViewDialog({ open: false, tx: null })}>ปิดหน้าต่าง</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnDialog.open} onOpenChange={(open) => !open && setReturnDialog({ open: false, tx: null })}>
        <DialogContent className="sm:max-w-[500px] w-[95vw] rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              บันทึกรับคืนทรัพย์สิน
            </DialogTitle>
            <DialogDescription>
              ตรวจสอบสภาพสินค้าก่อนรับคืนเข้าระบบ
            </DialogDescription>
          </DialogHeader>
          
          {returnDialog.tx && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted rounded-lg text-sm space-y-2">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-muted-foreground">สินค้า:</span>
                  <span className="font-medium truncate">
                    {returnDialog.tx.product_serials?.products?.name} 
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Serial:</span>
                  <span className="font-mono">{returnDialog.tx.product_serials?.serial_code}</span>
                </div>
              </div>

              <div className="space-y-3">
                <Label>สภาพสินค้าเมื่อรับคืน</Label>
                <RadioGroup 
                  value={returnCondition} 
                  onValueChange={setReturnCondition}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                >
                  <div className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer transition-colors ${returnCondition === 'ปกติ' ? 'border-green-500 bg-green-50' : ''}`}>
                    <RadioGroupItem value="ปกติ" id="cond-good" />
                    <Label htmlFor="cond-good" className="cursor-pointer w-full">ปกติ / สมบูรณ์</Label>
                  </div>
                  <div className={`flex items-center space-x-2 border p-3 rounded-md cursor-pointer transition-colors ${returnCondition === 'เสียหาย' ? 'border-red-500 bg-red-50' : ''}`}>
                    <RadioGroupItem value="เสียหาย" id="cond-bad" />
                    <Label htmlFor="cond-bad" className="cursor-pointer text-red-600 flex items-center gap-1 w-full">
                      <AlertTriangle className="h-3 w-3" /> ชำรุด / เสียหาย
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>หมายเหตุการรับคืน</Label>
                <Textarea 
                  placeholder="เช่น สายชาร์จหาย, มีรอยขีดข่วน..." 
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setReturnDialog({ open: false, tx: null })}>
              ยกเลิก
            </Button>
            <Button 
              className="w-full sm:w-auto"
              onClick={confirmReturn} 
              disabled={returnTransaction.isPending}
              variant={returnCondition === 'เสียหาย' ? 'destructive' : 'default'}
            >
              {returnTransaction.isPending ? 'กำลังบันทึก...' : 'ยืนยันการรับคืน'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </MainLayout>
  );
}