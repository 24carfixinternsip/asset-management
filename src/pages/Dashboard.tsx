import { useState, useMemo, useEffect } from "react";
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
  AlertTriangle, Search, Box, AlertCircle, 
  Filter, X, ImageIcon
} from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboard";
import { useRecentTransactions } from "@/hooks/useTransactions"; 
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ✅ Import Pagination Components
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentTransactions, isLoading: transactionsLoading } = useRecentTransactions(20);
  
  // --- States ---
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Pagination States
  const [invPage, setInvPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const [lowStockPage, setLowStockPage] = useState(1); // ✅ เพิ่ม Page สำหรับ Low Stock Dialog

  const INV_ITEMS_PER_PAGE = 5;
  const TX_ITEMS_PER_PAGE = 5;
  const LOW_STOCK_ITEMS_PER_PAGE = 5; // จำนวนต่อหน้าใน Dialog

  // Dialog States
  const [isLowStockOpen, setIsLowStockOpen] = useState(false);
  const [lowStockSearch, setLowStockSearch] = useState("");
  const [lowStockCategory, setLowStockCategory] = useState("all");

  // --- Logic ---

  // 1. Filter Inventory
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

  // 2. Filter Low Stock
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

  // --- Reset Pages on Filter Change ---
  useEffect(() => { setInvPage(1); }, [inventorySearch, selectedCategory]);
  useEffect(() => { setLowStockPage(1); }, [lowStockSearch, lowStockCategory]);

  // --- Pagination Slicing ---
  const paginatedInventory = filteredInventory.slice((invPage - 1) * INV_ITEMS_PER_PAGE, invPage * INV_ITEMS_PER_PAGE);
  const totalInvPages = Math.ceil(filteredInventory.length / INV_ITEMS_PER_PAGE);

  const paginatedTransactions = recentTransactions?.slice((txPage - 1) * TX_ITEMS_PER_PAGE, txPage * TX_ITEMS_PER_PAGE) || [];
  const totalTxPages = Math.ceil((recentTransactions?.length || 0) / TX_ITEMS_PER_PAGE);

  const paginatedLowStock = filteredLowStock.slice((lowStockPage - 1) * LOW_STOCK_ITEMS_PER_PAGE, lowStockPage * LOW_STOCK_ITEMS_PER_PAGE);
  const totalLowStockPages = Math.ceil(filteredLowStock.length / LOW_STOCK_ITEMS_PER_PAGE);

  // --- Helper: Pagination Generator (แก้ปัญหาตันที่หน้า 3) ---
  const getPaginationItems = (currentPage: number, totalPages: number) => {
    // กรณีจำนวนหน้าน้อย (แสดงทั้งหมด)
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // กรณีอยู่ช่วงต้น (เช่น หน้า 1, 2, 3, 4) -> แสดง 1 2 3 4 5 ... Last
    // ปรับให้กว้างขึ้นเพื่อให้กดไปหน้า 4-5 ได้ง่าย
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
    }

    // กรณีอยู่ช่วงท้าย (เช่น หน้า 98, 99, 100) -> แสดง 1 ... 96 97 98 99 100
    if (currentPage >= totalPages - 3) {
      return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    // กรณีอยู่ตรงกลาง -> แสดง 1 ... Prev Cur Next ... Last
    return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
  };

  // --- Helper: Render Pagination Component ---
  const renderPagination = (page: number, setPage: (p: number) => void, totalPages: number) => {
    if (totalPages <= 1) return null;
    return (
      <Pagination className="justify-end w-auto mx-0">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious 
              href="#" onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }} 
              className={page === 1 ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
          {getPaginationItems(page, totalPages).map((p, i) => (
            <PaginationItem key={i}>
              {p === 'ellipsis' ? <PaginationEllipsis /> : (
                <PaginationLink 
                  href="#" isActive={page === p} 
                  onClick={(e) => { e.preventDefault(); setPage(p as number); }}
                >
                  {p}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext 
              href="#" onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1); }}
              className={page === totalPages ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(value);
  const formatDate = (dateString: string) => format(new Date(dateString), 'd MMM HH:mm', { locale: th });

  return (
    <MainLayout title="ภาพรวมระบบ (Dashboard)">
      <div className="space-y-4 sm:space-y-6 pb-8">
        
        {/* KPI Cards */}
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

        {/* Main Grid */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-7 items-start">
          
          {/* Left Column: Inventory Table */}
          <div className="col-span-7 lg:col-span-5 space-y-4">
            <Card className="border-t-4 border-t-primary shadow-sm">
              <CardHeader className="px-6 py-4 border-b bg-muted/10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Box className="h-5 w-5 text-primary" />
                      สถานะคลังสินค้า
                    </CardTitle>
                    <CardDescription>สรุปยอดคงเหลือและการกระจายตัว</CardDescription>
                  </div>
                  
                  {/* Filters */}
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
              
              <CardContent className="p-0">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="pl-6 w-[40%]">สินค้า / รายละเอียด</TableHead>
                        <TableHead className="text-center w-[15%]">ทั้งหมด</TableHead>
                        <TableHead className="text-center w-[15%]">พร้อมใช้</TableHead>
                        <TableHead className="text-center w-[15%]">ถูกยืม</TableHead>
                        <TableHead className="text-center w-[15%]">ส่งซ่อม</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statsLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                           <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-14 w-full" /></TableCell></TableRow>
                        ))
                      ) : paginatedInventory.length > 0 ? (
                        paginatedInventory.map((item) => (
                          <TableRow key={item.id} className="hover:bg-muted/30 h-[72px]">
                            <TableCell className="pl-6">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 shrink-0 rounded border bg-muted flex items-center justify-center overflow-hidden">
                                   {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover"/> : <Package className="h-5 w-5 text-muted-foreground/50"/>}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-sm truncate max-w-[200px]" title={item.name}>{item.name}</span>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="font-mono bg-muted px-1 rounded border">{item.p_id}</span>
                                    <span className="truncate max-w-[150px]">{[item.brand, item.model].filter(Boolean).join(' ')}</span>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center"><span className="font-bold text-foreground/70">{item.total}</span></TableCell>
                            <TableCell className="text-center">{item.available > 0 ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{item.available}</Badge> : '-'}</TableCell>
                            <TableCell className="text-center">{item.borrowed > 0 ? <span className="text-orange-600 font-medium">{item.borrowed}</span> : '-'}</TableCell>
                            <TableCell className="text-center">{item.repair > 0 ? <span className="text-red-600 font-medium">{item.repair}</span> : '-'}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground">ไม่พบข้อมูล</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile List */}
                <div className="md:hidden divide-y">
                   {statsLoading ? Array.from({length:5}).map((_,i) => <div key={i} className="p-4"><Skeleton className="h-16 w-full"/></div>) : 
                    paginatedInventory.map(item => (
                       <div key={item.id} className="p-4 flex gap-3">
                          <div className="h-12 w-12 shrink-0 rounded border bg-muted flex items-center justify-center overflow-hidden">
                              {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover"/> : <Package className="h-6 w-6 text-muted-foreground/50"/>}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                             <div className="flex justify-between">
                                <span className="font-semibold text-sm truncate">{item.name}</span>
                                <Badge variant="secondary" className="text-[10px] h-5">{item.p_id}</Badge>
                             </div>
                             <div className="text-xs text-muted-foreground truncate">{[item.brand, item.model].filter(Boolean).join(' ')}</div>
                             <div className="flex gap-2 mt-1">
                                <Badge variant="outline" className="bg-green-50 text-green-700 h-5 text-[10px]">ว่าง {item.available}</Badge>
                                {item.borrowed > 0 && <Badge variant="outline" className="bg-orange-50 text-orange-700 h-5 text-[10px]">ยืม {item.borrowed}</Badge>}
                                {item.repair > 0 && <Badge variant="outline" className="bg-red-50 text-red-700 h-5 text-[10px]">ซ่อม {item.repair}</Badge>}
                             </div>
                          </div>
                       </div>
                    ))
                   }
                </div>

                {/* Pagination Footer */}
                <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/5">
                   <div className="text-xs text-muted-foreground text-center sm:text-left">
                      หน้า {invPage} จาก {totalInvPages} (ทั้งหมด {filteredInventory.length} รายการ)
                   </div>
                   <div className="w-full sm:w-auto flex justify-center sm:justify-end">
                      {renderPagination(invPage, setInvPage, totalInvPages)}
                   </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="col-span-7 lg:col-span-2 space-y-4 flex flex-col">
            
            {/* 1. Low Stock Alert Card */}
            <Card 
              className="border-red-200 bg-red-50/20 shadow-sm cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
              onClick={() => setIsLowStockOpen(true)}
            >
              <CardHeader className="px-4 py-3 border-b border-red-100 bg-red-50/40">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    เตือนสต็อกใกล้หมด
                  </div>
                  <Badge variant="destructive" className="h-5 px-1.5">{stats?.lowStockItems?.length || 0}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[200px]">
                  {stats?.lowStockItems && stats.lowStockItems.length > 0 ? (
                    <div className="divide-y divide-red-100/50">
                      {stats.lowStockItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 hover:bg-white/50 transition-colors">
                          <div className="flex items-center gap-3 overflow-hidden">
                             <div className="h-8 w-8 rounded border bg-white flex items-center justify-center overflow-hidden shrink-0">
                                {item.image ? <img src={item.image} className="h-full w-full object-cover"/> : <AlertCircle className="h-4 w-4 text-red-300"/>}
                             </div>
                             <div className="min-w-0">
                                <div className="text-xs font-semibold truncate w-[100px]">{item.name}</div>
                                <div className="text-[10px] text-muted-foreground truncate w-[100px]">{item.p_id}</div>
                             </div>
                          </div>
                          <div className="text-right">
                             <span className="text-red-600 font-bold text-xs">เหลือ {item.current}</span>
                             <div className="text-[9px] text-muted-foreground">จาก {item.total}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8 text-xs">
                      <Package className="h-8 w-8 mb-2 opacity-20" />
                      สต็อกเพียงพอทุกรายการ
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* 2. Recent Transactions */}
            <Card className="flex-1 flex flex-col shadow-sm">
              <CardHeader className="px-4 py-3 border-b bg-muted/10 shrink-0">
                 <div className="flex items-center justify-between">
                   <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ArrowLeftRight className="h-4 w-4 text-primary" /> รายการล่าสุด
                   </CardTitle>
                   <Button variant="link" size="sm" asChild className="h-auto p-0 text-[10px]">
                      <a href="/transactions">ดูทั้งหมด</a>
                   </Button>
                 </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col justify-between">
                 <div className="divide-y">
                    {transactionsLoading ? Array.from({length:5}).map((_,i)=><div key={i} className="p-3"><Skeleton className="h-8 w-full"/></div>) :
                     paginatedTransactions.length > 0 ? paginatedTransactions.map(tx => (
                       <div key={tx.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors h-[68px]">
                          <div className="flex items-center gap-3 overflow-hidden">
                             <Avatar className="h-8 w-8 border shrink-0">
                                <AvatarFallback className="text-[10px] bg-primary/5 text-primary">
                                   {tx.employees?.name?.substring(0,2) || 'UK'}
                                </AvatarFallback>
                             </Avatar>
                             <div className="flex flex-col min-w-0">
                                <span className="text-xs font-medium truncate w-[120px]">{tx.employees?.name || '-'}</span>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                   <span className={cn("px-1 rounded-[2px]", tx.status === 'Active' ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700")}>
                                      {tx.status === 'Active' ? 'ยืม' : 'คืน'}
                                   </span>
                                   <span className="truncate max-w-[80px]">{tx.product_serials?.products?.name}</span>
                                </div>
                             </div>
                          </div>
                          <div className="text-[10px] text-muted-foreground text-right shrink-0 whitespace-nowrap">
                             {formatDate(tx.created_at)}
                          </div>
                       </div>
                     )) : (
                       <div className="p-8 text-center text-xs text-muted-foreground">ไม่มีรายการเคลื่อนไหว</div>
                     )
                    }
                 </div>
                 
                 {/* Transaction Pagination */}
                 <div className="p-2 border-t bg-muted/5 flex justify-center">
                    {renderPagination(txPage, setTxPage, totalTxPages)}
                 </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      {/* --- Low Stock Dialog (With Pagination) --- */}
      {isLowStockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6 backdrop-blur-sm animate-in fade-in-0">
          <Card className="w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95">
            <CardHeader className="border-b px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0 bg-red-50/30">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  สินค้าใกล้หมด
                </CardTitle>
                <CardDescription className="text-xs">รายการคงเหลือ &lt; 3 ชิ้น</CardDescription>
              </div>
              
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
                      placeholder="ค้นหา..." className="h-9 pl-8 text-xs w-full" 
                      value={lowStockSearch} onChange={(e) => setLowStockSearch(e.target.value)}
                   />
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsLowStockOpen(false)} className="absolute top-2 right-2 sm:static sm:ml-2">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="p-0 overflow-hidden flex-1 flex flex-col">
              <ScrollArea className="flex-1">
                 {/* Dialog Table View */}
                 <div className="hidden sm:block">
                    <Table>
                       <TableHeader className="bg-muted/40 sticky top-0 z-10">
                          <TableRow>
                             <TableHead className="pl-6">สินค้า</TableHead>
                             <TableHead>รายละเอียด</TableHead>
                             <TableHead className="text-center">คงเหลือ</TableHead>
                             <TableHead className="text-center">ทั้งหมด</TableHead>
                             <TableHead className="text-right pr-6">สถานะ</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {paginatedLowStock.length > 0 ? paginatedLowStock.map(item => (
                             <TableRow key={item.id}>
                                <TableCell className="pl-6">
                                   <div className="flex items-center gap-3">
                                      <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center overflow-hidden">
                                         {item.image ? <img src={item.image} className="h-full w-full object-cover"/> : <ImageIcon className="h-4 w-4 opacity-50"/>}
                                      </div>
                                      <div>
                                         <div className="font-medium">{item.name}</div>
                                         <div className="text-xs text-muted-foreground font-mono">{item.p_id}</div>
                                      </div>
                                   </div>
                                </TableCell>
                                <TableCell>
                                   <div className="text-sm">{[item.brand, item.model].filter(Boolean).join(' / ') || '-'}</div>
                                   <div className="text-xs text-muted-foreground">{item.category}</div>
                                </TableCell>
                                <TableCell className="text-center">
                                   <span className="font-bold text-red-600 text-lg">{item.current}</span>
                                </TableCell>
                                <TableCell className="text-center text-muted-foreground">{item.total}</TableCell>
                                <TableCell className="text-right pr-6">
                                   <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">เติมด่วน</Badge>
                                </TableCell>
                             </TableRow>
                          )) : (
                             <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">ไม่พบรายการ</TableCell></TableRow>
                          )}
                       </TableBody>
                    </Table>
                 </div>

                 {/* Dialog Mobile List */}
                 <div className="sm:hidden divide-y">
                    {paginatedLowStock.length > 0 ? paginatedLowStock.map(item => (
                       <div key={item.id} className="p-4 flex gap-3">
                          <div className="h-12 w-12 rounded border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                              {item.image ? <img src={item.image} className="h-full w-full object-cover"/> : <ImageIcon className="h-5 w-5 opacity-50"/>}
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-start">
                                <div className="font-medium text-sm truncate pr-2">{item.name}</div>
                                <span className="text-red-600 font-bold text-sm">เหลือ {item.current}</span>
                             </div>
                             <div className="text-xs text-muted-foreground">{[item.brand, item.model].filter(Boolean).join(' ')}</div>
                             <div className="flex justify-between items-end mt-1">
                                <Badge variant="secondary" className="text-[10px] h-5">{item.p_id}</Badge>
                                <span className="text-[10px] text-muted-foreground">จากทั้งหมด {item.total}</span>
                             </div>
                          </div>
                       </div>
                    )) : <div className="p-8 text-center text-sm text-muted-foreground">ไม่พบรายการ</div>}
                 </div>
              </ScrollArea>

              {/* Dialog Pagination */}
              <div className="p-4 border-t flex items-center justify-between bg-muted/5 shrink-0">
                  <div className="text-xs text-muted-foreground hidden sm:block">
                     หน้า {lowStockPage} จาก {totalLowStockPages}
                  </div>
                  <div className="w-full sm:w-auto flex justify-center">
                     {renderPagination(lowStockPage, setLowStockPage, totalLowStockPages)}
                  </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </MainLayout>
  );
}