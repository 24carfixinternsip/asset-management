import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  DollarSign, Package, ArrowLeftRight, Wrench, 
  AlertTriangle, ChevronRight, Search, Box, AlertCircle, 
  Filter, X, ChevronLeft 
} from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboard";
import { useRecentTransactions } from "@/hooks/useTransactions"; 
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";

const CATEGORIES = [
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

// Helper Component: สร้างแถวว่างเพื่อให้ตารางมีความสูงคงที่
const EmptyRows = ({ count, height = 72, colSpan }: { count: number, height?: number, colSpan: number }) => {
  if (count <= 0) return null;
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <TableRow key={`empty-${index}`} className="hover:bg-transparent pointer-events-none" style={{ height: `${height}px` }}>
          <TableCell colSpan={colSpan}>&nbsp;</TableCell>
        </TableRow>
      ))}
    </>
  );
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentTransactions, isLoading: transactionsLoading } = useRecentTransactions(20);
  
  // --- States ---
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Pagination States
  const [invPage, setInvPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Dialog States (For Drill Down)
  const [isLowStockOpen, setIsLowStockOpen] = useState(false);
  const [lowStockSearch, setLowStockSearch] = useState("");
  const [lowStockCategory, setLowStockCategory] = useState("all");

  // --- Logic ---

  // 1. Filter Inventory (Main Table)
  const filteredInventory = useMemo(() => {
    if (!stats?.inventorySummary) return [];

    return stats.inventorySummary.filter(item => {
      if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
      if (!inventorySearch.trim()) return true;
      
      const searchTerms = inventorySearch.toLowerCase().split(/\s+/).filter(Boolean);
      const itemText = `${item.name} ${item.p_id} ${item.brand || ''} ${item.model || ''}`.toLowerCase();
      return searchTerms.every(term => itemText.includes(term));
    });
  }, [stats?.inventorySummary, inventorySearch, selectedCategory]);

  // 2. Paginate Inventory
  const totalInvPages = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);
  const paginatedInventory = filteredInventory.slice(
    (invPage - 1) * ITEMS_PER_PAGE,
    invPage * ITEMS_PER_PAGE
  );

  // 3. Paginate Transactions
  const totalTxPages = Math.ceil((recentTransactions?.length || 0) / ITEMS_PER_PAGE);
  const paginatedTransactions = recentTransactions?.slice(
    (txPage - 1) * ITEMS_PER_PAGE,
    txPage * ITEMS_PER_PAGE
  );

  // 4. Filter Low Stock (For Dialog)
  const filteredLowStock = useMemo(() => {
    if (!stats?.lowStockItems) return [];
    return stats.lowStockItems.filter(item => {
      if (lowStockCategory !== "all" && item.category !== lowStockCategory) return false;
      if (!lowStockSearch.trim()) return true;
      
      const searchTerms = lowStockSearch.toLowerCase().split(/\s+/).filter(Boolean);
      const itemText = `${item.name} ${item.p_id} ${item.brand || ''} ${item.model || ''}`.toLowerCase();
      return searchTerms.every(term => itemText.includes(term));
    });
  }, [stats?.lowStockItems, lowStockSearch, lowStockCategory]);

  // Reset Page when filter changes
  useMemo(() => { setInvPage(1); }, [inventorySearch, selectedCategory]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'd MMM HH:mm', { locale: th });
  };

  return (
    <MainLayout title="ภาพรวมระบบ (Dashboard)">
      <div className="space-y-4 sm:space-y-6">
        
        {/* KPI Cards: ปรับ Grid ให้รองรับ Mobile (1 col) -> Tablet (2 col) -> Desktop (4 col) */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
          ) : (
            <>
              <StatCard title="มูลค่าทรัพย์สินรวม" value={formatCurrency(stats?.totalValue || 0)} icon={DollarSign} variant="primary" className="bg-white/80" />
              <StatCard title="จำนวนรายการทั้งหมด" value={stats?.totalItems.toLocaleString() || '0'} icon={Package} variant="default" description={`พร้อมใช้: ${stats?.availableCount || 0}`} />
              <StatCard title="กำลังถูกยืม" value={stats?.borrowedCount.toLocaleString() || '0'} icon={ArrowLeftRight} variant="warning" description="สินค้าที่อยู่กับพนักงาน" />
              <StatCard title="แจ้งซ่อม / เสีย" value={stats?.repairCount.toLocaleString() || '0'} icon={Wrench} variant="destructive" description="ต้องดำเนินการตรวจสอบ" />
            </>
          )}
        </div>

        {/* Main Content: ปรับ gap ให้กระชับขึ้นใน Mobile */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-7 h-full">
          
          {/* Inventory Status Table */}
          <div className="col-span-7 lg:col-span-5 space-y-4 sm:space-y-6">
            <Card className="border-t-4 border-t-[#F15A24] shadow-sm flex flex-col min-h-[420px] md:min-h-[520px]">
              <CardHeader className="pb-3 px-4 pt-5 shrink-0 sm:px-6 sm:pt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Box className="h-5 w-5 text-blue-600" />
                      สถานะคลังสินค้า
                    </CardTitle>
                    <CardDescription>สรุปยอดคงเหลือและการกระจายตัว</CardDescription>
                  </div>
                  
                  {/* Filters: ปรับให้เต็มจอใน Mobile (flex-wrap) */}
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs bg-background">
                        <div className="flex items-center gap-2 truncate">
                          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                          <SelectValue placeholder="หมวดหมู่" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทั้งหมด</SelectItem>
                        {CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <div className="relative w-full sm:w-[200px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input 
                        placeholder="ค้นหา..." 
                        className="h-9 pl-8 text-xs bg-background w-full"
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                      />
                      {inventorySearch && (
                        <button onClick={() => setInventorySearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-0 flex-1 flex flex-col justify-between overflow-hidden">
                {/* Desktop Table View */}
                <div className="border-t overflow-x-auto hidden md:block">
                  <Table className="min-w-[720px]">
                    <TableHeader className="bg-muted/40 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-[45%] pl-6">สินค้า / รายละเอียด (SKU)</TableHead>
                        <TableHead className="text-center w-[12%] text-blue-600 font-semibold text-xs bg-blue-50/30">ทั้งหมด</TableHead>
                        <TableHead className="text-center w-[12%] text-green-600 font-semibold text-xs bg-green-50/30">พร้อมใช้</TableHead>
                        <TableHead className="text-center w-[12%] text-orange-600 font-semibold text-xs bg-orange-50/30">ถูกยืม</TableHead>
                        <TableHead className="text-center w-[12%] text-red-600 font-semibold text-xs bg-red-50/30">ส่งซ่อม</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statsLoading ? (
                        Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                          <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-14 w-full" /></TableCell></TableRow>
                        ))
                      ) : paginatedInventory.length > 0 ? (
                        <>
                          {paginatedInventory.map((item) => (
                            <TableRow key={item.id} className="hover:bg-muted/30 transition-colors h-[72px]">
                              <TableCell className="px-4 py-2 sm:pl-6">
                                <div className="flex items-start gap-3">
                                  <div className="shrink-0 mt-0.5">
                                    {item.image ? (
                                      <img src={item.image} alt={item.name} className="h-10 w-10 rounded-md border object-cover bg-white" />
                                    ) : (
                                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                                        <Package className="h-5 w-5" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-1 min-w-0">
                                    <span className="font-semibold text-sm leading-tight text-foreground truncate max-w-[200px]" title={item.name}>{item.name}</span>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px] border border-border">{item.p_id}</span>
                                      {(item.brand || item.model) && (
                                        <span className="flex items-center gap-1 truncate max-w-[150px]">
                                          {item.brand && <span className="font-medium text-foreground/80">{item.brand}</span>}
                                          {item.brand && item.model && <span>·</span>}
                                          {item.model && <span>{item.model}</span>}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-bold text-sm bg-blue-50/10 text-foreground/80">{item.total}</TableCell>
                              <TableCell className="text-center bg-green-50/10">
                                {item.available > 0 ? (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50 font-bold px-2.5">{item.available}</Badge>
                                ) : <span className="text-muted-foreground/30 text-xs">-</span>}
                              </TableCell>
                              <TableCell className="text-center bg-orange-50/10">
                                {item.borrowed > 0 ? <span className="text-orange-600 font-medium text-sm">{item.borrowed}</span> : <span className="text-muted-foreground/30 text-xs">-</span>}
                              </TableCell>
                              <TableCell className="text-center bg-red-50/10">
                                {item.repair > 0 ? <span className="text-red-600 font-medium text-sm">{item.repair}</span> : <span className="text-muted-foreground/30 text-xs">-</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                          <EmptyRows count={ITEMS_PER_PAGE - paginatedInventory.length} colSpan={5} />
                        </>
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-[360px] text-center text-muted-foreground">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Search className="h-8 w-8 opacity-20" />
                              <p className="text-sm">ไม่พบสินค้า</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile List View (Optimized) */}
                <div className="border-t divide-y md:hidden">
                  {statsLoading ? (
                    Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                      <div key={i} className="p-3"><Skeleton className="h-16 w-full" /></div>
                    ))
                  ) : paginatedInventory.length > 0 ? (
                    paginatedInventory.map((item) => (
                      <div key={item.id} className="p-3 flex gap-3 active:bg-muted/50 transition-colors">
                        <div className="shrink-0">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="h-12 w-12 rounded-md border object-cover bg-white" />
                          ) : (
                            <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm text-foreground truncate" title={item.name}>{item.name}</span>
                            <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border">{item.p_id}</span>
                          </div>
                          {(item.brand || item.model) && (
                            <div className="text-xs text-muted-foreground truncate">{[item.brand, item.model].filter(Boolean).join(" · ")}</div>
                          )}
                          <div className="flex items-center gap-1.5 text-xs pt-1">
                            <Badge variant="outline" className="h-5 px-1.5 bg-blue-50 text-blue-700 border-blue-200">รวม {item.total}</Badge>
                            <Badge variant="outline" className="h-5 px-1.5 bg-green-50 text-green-700 border-green-200">ว่าง {item.available}</Badge>
                            {(item.borrowed > 0 || item.repair > 0) && (
                              <div className="flex gap-1">
                                {item.borrowed > 0 && <span className="text-[10px] text-orange-600 px-1 bg-orange-50 rounded border border-orange-100">ยืม {item.borrowed}</span>}
                                {item.repair > 0 && <span className="text-[10px] text-red-600 px-1 bg-red-50 rounded border border-red-100">ซ่อม {item.repair}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                       <div className="flex flex-col items-center justify-center gap-2">
                          <Search className="h-8 w-8 opacity-20" />
                          <p>ไม่พบสินค้า</p>
                        </div>
                    </div>
                  )}
                </div>

                <div className="p-3 border-t bg-muted/5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-muted-foreground text-center sm:text-left">
                    แสดง {paginatedInventory.length > 0 ? (invPage - 1) * ITEMS_PER_PAGE + 1 : 0} ถึง {Math.min(invPage * ITEMS_PER_PAGE, filteredInventory.length)} จาก {filteredInventory.length}
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setInvPage(p => Math.max(1, p - 1))} disabled={invPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-xs px-3 font-medium">หน้า {invPage} / {Math.max(1, totalInvPages)}</div>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setInvPage(p => Math.min(totalInvPages, p + 1))} disabled={invPage === totalInvPages || totalInvPages === 0}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="col-span-7 lg:col-span-2 space-y-4 sm:space-y-6 flex flex-col">
            
            {/* 1. Low Stock Alerts */}
            <Card 
              className="border-red-200 bg-red-50/30 shadow-sm shrink-0 cursor-pointer hover:shadow-md transition-shadow group active:scale-[0.99] transition-transform"
              onClick={() => setIsLowStockOpen(true)}
            >
              <CardHeader className="pb-3 px-4 pt-4 border-b border-red-100 bg-red-50/50 group-hover:bg-red-50/80 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      เตือนสต็อกใกล้หมด
                    </CardTitle>
                    <CardDescription className="text-xs text-red-600/80 mt-1">เหลือพร้อมใช้น้อยกว่า 3 ชิ้น</CardDescription>
                  </div>
                  <Badge variant="destructive" className="text-[10px] h-5 px-1.5">{stats?.lowStockItems?.length || 0}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[200px]">
                  {stats?.lowStockItems && stats.lowStockItems.length > 0 ? (
                    <div className="divide-y divide-red-100/50">
                      {stats.lowStockItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between bg-white/60 p-3 hover:bg-white transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 shrink-0 rounded bg-white flex items-center justify-center border border-red-100 overflow-hidden">
                              {item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover"/> : <AlertCircle className="h-4 w-4 text-red-300" />}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold truncate w-[110px] sm:w-[80px] lg:w-[110px] text-foreground" title={item.name}>{item.name}</span>
                              <div className="text-[10px] text-muted-foreground truncate w-[110px] sm:w-[80px] lg:w-[110px]">
                                {[item.brand, item.model].filter(Boolean).join(' ')}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-bold mb-0.5">
                              เหลือ {item.current}
                            </Badge>
                            <div className="text-[9px] text-muted-foreground">จาก {item.total}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-10">
                      <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center mb-2">
                        <Package className="h-5 w-5 text-green-600" />
                      </div>
                      <span className="text-xs">สต็อกเพียงพอทุกรายการ</span>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* 2. Recent Activity */}
            <Card className="flex flex-col shadow-sm flex-1 min-h-[400px]">
              <CardHeader className="pb-3 border-b bg-muted/20 px-4 pt-4 shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">รายการล่าสุด</CardTitle>
                  <Button variant="link" size="sm" asChild className="h-auto p-0 text-[10px] text-primary">
                    <a href="/transactions">ดูทั้งหมด</a>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col justify-between">
                <div>
                  {transactionsLoading ? (
                    <div className="p-4 space-y-3">
                      {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  ) : paginatedTransactions && paginatedTransactions.length > 0 ? (
                    <>
                      <div className="divide-y">
                        {paginatedTransactions.map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors h-[72px]">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <Avatar className="h-8 w-8 border shrink-0">
                                <AvatarFallback className="text-[10px] bg-primary/5 text-primary font-medium">
                                  {tx.employees?.name?.substring(0,2) || tx.departments?.name?.substring(0,2)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col min-w-0 gap-0.5">
                                <span className="text-xs font-medium truncate w-[130px] sm:w-[100px] lg:w-[130px] text-foreground">
                                  {tx.employees?.name || tx.departments?.name}
                                </span>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                  <span className={cn(
                                    "font-bold px-1 rounded-[3px] shrink-0",
                                    tx.status === 'Active' ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"
                                  )}>
                                    {tx.status === 'Active' ? 'ยืม' : 'คืน'}
                                  </span>
                                  <span className="truncate max-w-[80px] sm:max-w-[60px] lg:max-w-[80px]" title={tx.product_serials?.products?.name}>
                                    {tx.product_serials?.products?.name}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-[10px] text-muted-foreground text-right shrink-0 whitespace-nowrap pl-2">
                              {formatDate(tx.created_at)}
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Fill Empty Rows */}
                      {Array.from({ length: ITEMS_PER_PAGE - paginatedTransactions.length }).map((_, i) => (
                        <div key={`empty-tx-${i}`} className="h-[72px]" />
                      ))}
                    </>
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground h-[360px] flex items-center justify-center">
                      ไม่มีรายการเคลื่อนไหว
                    </div>
                  )}
                </div>

                {/* Transactions Pagination */}
                {recentTransactions && recentTransactions.length > 0 && (
                  <div className="p-2 border-t bg-muted/5 flex items-center justify-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTxPage(p => Math.max(1, p - 1))} disabled={txPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-[10px] text-muted-foreground px-2">{txPage} / {totalTxPages}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))} disabled={txPage === totalTxPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>

      {/* --- Low Stock Drill Down Dialog (Mobile Optimized) --- */}
      {isLowStockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6 backdrop-blur-sm">
          <Card className="w-full max-w-4xl max-h-[85vh] flex flex-col animate-in fade-in-0 zoom-in-95">
            <CardHeader className="border-b px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0 bg-red-50/30 sm:px-6">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  สินค้าใกล้หมด
                </CardTitle>
                <CardDescription className="text-xs">รายการคงเหลือ &lt; 3 ชิ้น</CardDescription>
              </div>
              
              {/* Search & Filter */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center w-full sm:w-auto">
                <Select value={lowStockCategory} onValueChange={setLowStockCategory}>
                  <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs">
                    <SelectValue placeholder="หมวดหมู่" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    {CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="relative w-full sm:w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input 
                    placeholder="ค้นหา..." 
                    className="h-9 pl-8 text-xs w-full" 
                    value={lowStockSearch}
                    onChange={(e) => setLowStockSearch(e.target.value)}
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsLowStockOpen(false)} className="absolute top-2 right-2 sm:static sm:ml-2">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="p-0 overflow-hidden flex-1">
              <ScrollArea className="h-full">
                {/* Mobile: List View inside Dialog */}
                <div className="block sm:hidden">
                    {filteredLowStock.length > 0 ? (
                      <div className="divide-y">
                        {filteredLowStock.map((item) => (
                           <div key={item.id} className="p-3 flex gap-3">
                              <div className="h-10 w-10 bg-muted rounded flex items-center justify-center shrink-0 overflow-hidden border">
                                {item.image ? <img src={item.image} className="w-full h-full object-cover"/> : <Package className="h-5 w-5 opacity-50"/>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between">
                                  <div className="font-medium text-sm truncate pr-2">{item.name}</div>
                                  <span className="text-red-600 font-bold text-sm shrink-0">เหลือ {item.current}</span>
                                </div>
                                <div className="text-xs text-muted-foreground">{[item.brand, item.model].filter(Boolean).join(' ')}</div>
                                <div className="flex justify-between items-end mt-1">
                                  <span className="text-[10px] bg-muted px-1 rounded">{item.p_id}</span>
                                  <span className="text-[10px] text-muted-foreground">จากทั้งหมด {item.total}</span>
                                </div>
                              </div>
                           </div>
                        ))}
                      </div>
                    ) : <div className="p-8 text-center text-muted-foreground text-sm">ไม่พบรายการ</div>}
                </div>

                {/* Tablet/Desktop: Table View */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table className="min-w-[600px]">
                    <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                      <TableRow>
                      <TableHead>สินค้า</TableHead>
                      <TableHead>รายละเอียด</TableHead>
                      <TableHead className="text-center">คงเหลือ</TableHead>
                      <TableHead className="text-center">ทั้งหมด</TableHead>
                      <TableHead className="text-right">สถานะ</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {filteredLowStock.length > 0 ? (
                      filteredLowStock.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {item.image ? (
                                <img src={item.image} className="h-10 w-10 rounded border object-cover" />
                              ) : (
                                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center"><Package className="h-4 w-4 opacity-50"/></div>
                              )}
                              <div>
                                <div className="font-medium">{item.name}</div>
                                <div className="text-xs text-muted-foreground font-mono">{item.p_id}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {[item.brand, item.model].filter(Boolean).join(' / ') || '-'}
                            </div>
                            <div className="text-xs text-muted-foreground">{item.category}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-bold text-red-600 text-lg">{item.current}</span>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            {item.total}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">เติมด่วน</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                          ไม่พบรายการที่ค้นหา
                        </TableCell>
                      </TableRow>
                    )}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

    </MainLayout>
  );
}