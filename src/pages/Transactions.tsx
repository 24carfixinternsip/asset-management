import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { Clock, History, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useTransactions, useCreateTransaction, useReturnTransaction, Transaction } from "@/hooks/useTransactions";
import { useAvailableSerials } from "@/hooks/useSerials";
import { useEmployees, useDepartments } from "@/hooks/useMasterData";
import { cn } from "@/lib/utils";

// Components
import { TransactionList } from "@/components/transactions/TransactionList";
import { BorrowTab } from "@/components/transactions/BorrowTab";
import { ViewTransactionDialog, ReturnDialog } from "@/components/transactions/TransactionDialogs";

export default function Transactions() {
  // 1. Local State for Pagination & Filters
  const [activePage, setActivePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  
  const [filterType, setFilterType] = useState<'all' | 'employee' | 'department'>('all');
  const [filterId, setFilterId] = useState<string>(''); 
  const [activeSearch, setActiveSearch] = useState("");
  
  const [returnDialog, setReturnDialog] = useState<{ open: boolean; tx: Transaction | null }>({ open: false, tx: null });
  const [viewDialog, setViewDialog] = useState<{ open: boolean; tx: Transaction | null }>({ open: false, tx: null });

  // 2. Hooks & Data (ส่ง page ไปด้วย)
  const { data: activeData, isLoading: activeLoading } = useTransactions('Active', activePage);
  const { data: historyData, isLoading: completedLoading } = useTransactions('Completed', historyPage);
  
  const { data: availableSerials } = useAvailableSerials();
  const { data: employees } = useEmployees();
  const { data: departments } = useDepartments(); 
  
  const createTransaction = useCreateTransaction();
  const returnTransaction = useReturnTransaction();

  // 3. Extract Arrays from Pagination Object
  // ✅ แก้ไข: ดึง array ออกมาจาก property .data เพราะตอนนี้ return มาเป็น Object { data, total, totalPages }
  const activeTransactions = activeData?.data || [];
  const completedTransactions = historyData?.data || [];

  // 4. Logic & Handlers
  const filteredActiveTransactions = useMemo(() => {
    // หมายเหตุ: การ Filter ตรงนี้จะทำเฉพาะข้อมูลในหน้าปัจจุบัน (20 รายการ)
    // ถ้าต้องการ Search จากข้อมูลทั้งหมดต้องแก้ API ให้รับ parameter search
    return activeTransactions.filter(tx => {
      let matchesEntity = true;
      if (filterType === 'employee' && filterId) matchesEntity = tx.employee_id === filterId;
      else if (filterType === 'department' && filterId) matchesEntity = tx.department_id === filterId || tx.employees?.department_id === filterId;

      const searchLower = activeSearch.toLowerCase();
      const matchesSearch = !activeSearch || 
         tx.product_serials?.serial_code?.toLowerCase().includes(searchLower) || 
         tx.product_serials?.products?.name?.toLowerCase().includes(searchLower);
      
      return matchesEntity && matchesSearch;
    });
  }, [activeTransactions, filterType, filterId, activeSearch]);

  const handleReturnConfirm = async () => {
    if (!returnDialog.tx) return;
    await returnTransaction.mutateAsync({ transactionId: returnDialog.tx.id, serialId: returnDialog.tx.serial_id });
    setReturnDialog({ open: false, tx: null });
  };

  // Helper สำหรับปุ่มเปลี่ยนหน้า
  const renderPagination = (currentPage: number, setPage: (p: number) => void, totalPages: number) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" /> ก่อนหน้า
        </Button>
        <span className="text-sm text-muted-foreground">
          หน้า {currentPage} จาก {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          ถัดไป <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  // 5. Render
  return (
    <MainLayout title="ระบบเบิก-จ่ายและคืนทรัพย์สิน">
      <div className="space-y-6">
        <Tabs defaultValue="borrow" className="space-y-6">
          <TabsList className="grid w-full min-w-[300px] max-w-[400px] grid-cols-3">
            <TabsTrigger value="borrow">ทำรายการเบิก</TabsTrigger>
            <TabsTrigger value="active">รายการถูกยืม</TabsTrigger>
            <TabsTrigger value="history">ประวัติย้อนหลัง</TabsTrigger>
          </TabsList>

          {/* --- Tab 1: Borrow Form --- */}
          <TabsContent value="borrow">
             <BorrowTab 
                employees={employees} 
                departments={departments} 
                availableSerials={availableSerials} 
                createTransaction={createTransaction} 
             />
          </TabsContent>

          {/* --- Tab 2: Active Loans (With Filter) --- */}
          <TabsContent value="active">
            <Card>
              <CardHeader className="p-4 sm:p-6 border-b">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Clock className="h-5 w-5 text-warning shrink-0" /> รายการที่กำลังถูกยืม</CardTitle>
                    <CardDescription>จัดการรายการที่ยังไม่ได้คืน</CardDescription>
                  </div>
                  {/* Filter Toolbar */}
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full xl:w-auto">
                    <Select value={filterType} onValueChange={(val: any) => { setFilterType(val); setFilterId(''); }}>
                        <SelectTrigger className="h-9 w-full sm:w-[130px]"><SelectValue placeholder="ประเภท" /></SelectTrigger>
                        <SelectContent><SelectItem value="all">ทั้งหมด</SelectItem><SelectItem value="employee">รายบุคคล</SelectItem><SelectItem value="department">รายแผนก</SelectItem></SelectContent>
                    </Select>
                    <div className={cn("w-full sm:w-[200px]", filterType === 'all' && "opacity-50 pointer-events-none")}>
                        <SearchableSelect 
                           items={filterType === 'employee' ? employees?.map(e => ({ value: e.id, label: e.name })) || [] : departments?.map(d => ({ value: d.id, label: d.name })) || []} 
                           value={filterId} onValueChange={setFilterId} placeholder={filterType === 'employee' ? "เลือกคน..." : "เลือกแผนก..."} disabled={filterType === 'all'} 
                        />
                    </div>
                    <div className="relative col-span-2 sm:col-span-1 sm:w-[180px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input placeholder="ค้นหา..." className="pl-8 h-9" value={activeSearch} onChange={(e) => setActiveSearch(e.target.value)} />
                        {activeSearch && <button onClick={() => setActiveSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-3 w-3" /></button>}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <div className="p-0">
                <TransactionList 
                  data={filteredActiveTransactions} 
                  isLoading={activeLoading} 
                  variant="active" 
                  onView={(tx) => setViewDialog({ open: true, tx })} 
                  onReturn={(tx) => setReturnDialog({ open: true, tx })} 
                />
              </div>
              <CardFooter className="border-t p-2 px-6">
                {/* Pagination Control */}
                {activeData && renderPagination(activePage, setActivePage, activeData.totalPages)}
              </CardFooter>
            </Card>
          </TabsContent>

          {/* --- Tab 3: History --- */}
          <TabsContent value="history">
            <Card>
              <CardHeader className="border-b"><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> ประวัติการเบิก-คืนย้อนหลัง</CardTitle></CardHeader>
              <div className="p-0">
                <TransactionList 
                  data={completedTransactions} 
                  isLoading={completedLoading} 
                  variant="history" 
                  onView={(tx) => setViewDialog({ open: true, tx })} 
                />
              </div>
              <CardFooter className="border-t p-2 px-6">
                 {/* Pagination Control */}
                 {historyData && renderPagination(historyPage, setHistoryPage, historyData.totalPages)}
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* --- Dialogs --- */}
      <ViewTransactionDialog open={viewDialog.open} onOpenChange={(o) => setViewDialog(prev => ({ ...prev, open: o }))} tx={viewDialog.tx} />
      <ReturnDialog open={returnDialog.open} onOpenChange={(o) => setReturnDialog(prev => ({ ...prev, open: o }))} tx={returnDialog.tx} onConfirm={handleReturnConfirm} isPending={returnTransaction.isPending} />
    </MainLayout>
  );
}