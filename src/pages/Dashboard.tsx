import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
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
  Filter, X, ImageIcon,
  ChevronLeft, ChevronRight
} from "lucide-react";

import { useDashboardStats, useDashboardInventory } from "@/hooks/useDashboard"; 
import { useRecentTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useMasterData";

import { format } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default function Dashboard() {
  // Fetch Data
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: inventorySummary, isLoading: inventoryLoading } = useDashboardInventory();
  const { data: recentTransactions, isLoading: transactionsLoading } = useRecentTransactions(20);
  const { data: categoriesData } = useCategories();
  const categoryOptions = categoriesData?.map(c => c.name) || [];

  // --- States ---
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Pagination States
  const [invPage, setInvPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const [lowStockPage, setLowStockPage] = useState(1);

  const INV_ITEMS_PER_PAGE = 5;
  const TX_ITEMS_PER_PAGE = 5;
  const LOW_STOCK_ITEMS_PER_PAGE = 5;

  // Dialog States
  const [isLowStockOpen, setIsLowStockOpen] = useState(false);
  const [lowStockSearch, setLowStockSearch] = useState("");
  const [lowStockCategory, setLowStockCategory] = useState("all");

  // --- Logic ---
  // Filter Inventory Table
  const filteredInventory = useMemo(() => {
    if (!inventorySummary) return [];

    return inventorySummary.filter(item => {
      if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
      if (!inventorySearch.trim()) return true;
      
      const searchTerms = inventorySearch.toLowerCase().split(/\s+/).filter(Boolean);
      const itemText = `${item.name} ${item.p_id} ${item.brand || ''} ${item.model || ''}`.toLowerCase();
      return searchTerms.every(term => itemText.includes(term));
    });
  }, [inventorySummary, inventorySearch, selectedCategory]);

  // Filter Low Stock
  const filteredLowStock = useMemo(() => {
    if (!inventorySummary) return [];

    const lowStockItems = inventorySummary.filter(item => item.available < 3 && item.total > 0);

    return lowStockItems.filter(item => {
      if (lowStockCategory !== "all" && item.category !== lowStockCategory) return false;
      if (!lowStockSearch.trim()) return true;
      
      const searchTerms = lowStockSearch.toLowerCase().split(/\s+/).filter(Boolean);
      const itemText = `${item.name} ${item.p_id} ${item.brand || ''} ${item.model || ''}`.toLowerCase();
      return searchTerms.every(term => itemText.includes(term));
    });
  }, [inventorySummary, lowStockSearch, lowStockCategory]);

  // --- Reset Pages ---
  useEffect(() => { setInvPage(1); }, [inventorySearch, selectedCategory]);
  useEffect(() => { setLowStockPage(1); }, [lowStockSearch, lowStockCategory]);

  // --- Pagination Helper ---
  const getPaginationItems = (currentPage: number, totalPages: number) => {
    // Mobile optimization: Show fewer items
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 3) return [1, 2, 3, 'ellipsis', totalPages];
    if (currentPage >= totalPages - 2) return [1, 'ellipsis', totalPages - 2, totalPages - 1, totalPages];
    return [1, 'ellipsis', currentPage, 'ellipsis', totalPages];
  };

  const renderPagination = (page: number, setPage: (p: number) => void, totalPages: number) => {
    if (totalPages <= 1) return null;
    return (
      <Pagination className="justify-center sm:justify-end w-auto mx-0">
        <PaginationContent className="gap-1">
          <PaginationItem>
            <PaginationPrevious 
              href="#" onClick={(e) => { e.preventDefault(); if (page > 1) setPage(page - 1); }} 
              className={cn("h-8 w-8 p-0 sm:w-auto sm:px-3 sm:py-2", page === 1 && "pointer-events-none opacity-50")}
            >
              <span className="sr-only sm:not-sr-only sm:ml-2">ก่อนหน้า</span>
            </PaginationPrevious>
          </PaginationItem>
          {getPaginationItems(page, totalPages).map((p, i) => (
            <PaginationItem key={i}>
              {p === 'ellipsis' ? <PaginationEllipsis className="h-8 w-4 sm:w-8" /> : (
                <PaginationLink 
                   href="#" 
                   isActive={page === p} 
                   onClick={(e) => { e.preventDefault(); setPage(p as number); }}
                   className="h-8 w-8 sm:w-9 sm:h-9 text-xs sm:text-sm"
                >
                  {p}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext 
              href="#" onClick={(e) => { e.preventDefault(); if (page < totalPages) setPage(page + 1); }}
              className={cn("h-8 w-8 p-0 sm:w-auto sm:px-3 sm:py-2", page === totalPages && "pointer-events-none opacity-50")}
            >
              <span className="sr-only sm:not-sr-only sm:mr-2">ถัดไป</span>
            </PaginationNext>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  // --- Pagination Slicing ---
  const paginatedInventory = filteredInventory.slice((invPage - 1) * INV_ITEMS_PER_PAGE, invPage * INV_ITEMS_PER_PAGE);
  const totalInvPages = Math.ceil(filteredInventory.length / INV_ITEMS_PER_PAGE);

  const paginatedTransactions = recentTransactions?.slice((txPage - 1) * TX_ITEMS_PER_PAGE, txPage * TX_ITEMS_PER_PAGE) || [];
  const totalTxPages = Math.ceil((recentTransactions?.length || 0) / TX_ITEMS_PER_PAGE);

  const paginatedLowStock = filteredLowStock.slice((lowStockPage - 1) * LOW_STOCK_ITEMS_PER_PAGE, lowStockPage * LOW_STOCK_ITEMS_PER_PAGE);
  const totalLowStockPages = Math.ceil(filteredLowStock.length / LOW_STOCK_ITEMS_PER_PAGE);

  const formatCurrency = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(value);
  const formatDate = (dateString: string) => format(new Date(dateString), 'd MMM HH:mm', { locale: th });
  
  const isTableLoading = statsLoading || inventoryLoading;

  return (
    <MainLayout title="ภาพรวมระบบ">
      <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-8">
        
        {/* KPI Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
          ) : (
            <>
              <StatCard title="มูลค่ารวม" value={formatCurrency(stats?.totalValue || 0)} icon={DollarSign} variant="primary" className="bg-white/80" />
              <StatCard title="จำนวนทั้งหมด" value={stats?.totalItems.toLocaleString() || '0'} icon={Package} variant="default" description={`พร้อมใช้: ${stats?.availableCount || 0}`} />
              <StatCard title="กำลังถูกยืม" value={stats?.borrowedCount.toLocaleString() || '0'} icon={ArrowLeftRight} variant="warning" description="อยู่กับพนักงาน" />
              <StatCard title="แจ้งซ่อม" value={stats?.repairCount.toLocaleString() || '0'} icon={Wrench} variant="destructive" description="ต้องตรวจสอบ" />
            </>
          )}
        </div>

        {/* Main Grid */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-7 items-start">
          
          {/* Inventory Table */}
          <div className="col-span-1 md:col-span-7 lg:col-span-5 space-y-4 min-w-0">
            <Card className="border-t-4 border-t-primary shadow-sm overflow-hidden">
              {/* Header Inventory */}
              <div className="px-4 sm:px-6 py-4 border-b bg-muted/10 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                        <Box className="h-5 w-5 text-primary" />
                        สถานะคลังสินค้า
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm">สรุปยอดคงเหลือและการกระจายตัว</CardDescription>
                    </div>
                </div>
                
                {/* Filter Controls: Stack on mobile */}
                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full sm:w-[160px] h-10 text-xs sm:text-sm bg-background shrink-0">
                      <div className="flex items-center gap-2 truncate">
                        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue placeholder="หมวดหมู่" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      {categoryOptions.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  <div className="relative w-full sm:w-[250px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input 
                      placeholder="ค้นหา..." className="h-10 pl-9 text-xs sm:text-sm bg-background w-full"
                      value={inventorySearch} onChange={(e) => setInventorySearch(e.target.value)}
                    />
                    {inventorySearch && (
                      <button onClick={() => setInventorySearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
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
                      {isTableLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-14 w-full" /></TableCell></TableRow>))
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

                {/* Mobile List View - Optimized */}
                <div className="md:hidden divide-y">
                   {isTableLoading ? Array.from({length:5}).map((_,i) => <div key={i} className="p-4"><Skeleton className="h-16 w-full"/></div>) : 
                    paginatedInventory.length > 0 ? paginatedInventory.map(item => (
                       <div key={item.id} className="p-3 sm:p-4 flex gap-3">
                          <div className="h-12 w-12 shrink-0 rounded border bg-muted flex items-center justify-center overflow-hidden mt-1">
                              {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover"/> : <Package className="h-6 w-6 text-muted-foreground/50"/>}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                             <div className="flex justify-between items-start gap-2">
                                <span className="font-semibold text-sm truncate">{item.name}</span>
                                <Badge variant="secondary" className="text-[10px] h-5 shrink-0 font-mono">{item.p_id}</Badge>
                             </div>
                             <div className="text-xs text-muted-foreground truncate">{[item.brand, item.model].filter(Boolean).join(' ')}</div>
                             <div className="flex flex-wrap gap-2 mt-1.5">
                                <Badge variant="outline" className="bg-green-50 text-green-700 h-5 text-[10px] px-1.5">ว่าง {item.available}</Badge>
                                {item.borrowed > 0 && <Badge variant="outline" className="bg-orange-50 text-orange-700 h-5 text-[10px] px-1.5">ยืม {item.borrowed}</Badge>}
                                {item.repair > 0 && <Badge variant="outline" className="bg-red-50 text-red-700 h-5 text-[10px] px-1.5">ซ่อม {item.repair}</Badge>}
                             </div>
                          </div>
                       </div>
                    )) : <div className="p-8 text-center text-muted-foreground">ไม่พบข้อมูล</div>
                   }
                </div>

                {/* Pagination */}
                <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/5">
                   <div className="text-xs text-muted-foreground text-center sm:text-left">
                      หน้า {invPage} / {totalInvPages} ({filteredInventory.length} รายการ)
                   </div>
                   <div className="w-full sm:w-auto">
                      {renderPagination(invPage, setInvPage, totalInvPages)}
                   </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="col-span-1 md:col-span-7 lg:col-span-2 space-y-4 flex flex-col min-w-0">
            
            {/* 1. Low Stock Alert Card */}
            <Card 
              className="border-red-200 bg-red-50/20 shadow-sm cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
              onClick={() => setIsLowStockOpen(true)}
            >
              <div className="px-4 py-3 border-b border-red-100 bg-red-50/40 flex justify-between items-center">
                <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  เตือนสต็อกใกล้หมด
                </div>
                <Badge variant="destructive" className="h-5 px-1.5">{filteredLowStock.length}</Badge>
              </div>
              <CardContent className="p-0">
                <ScrollArea className="h-[200px]">
                  {filteredLowStock.length > 0 ? (
                    <div className="divide-y divide-red-100/50">
                      {filteredLowStock.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 hover:bg-white/50 transition-colors">
                          <div className="flex items-center gap-3 overflow-hidden min-w-0">
                             <div className="h-8 w-8 rounded border bg-white flex items-center justify-center overflow-hidden shrink-0">
                                {item.image ? <img src={item.image} className="h-full w-full object-cover"/> : <AlertCircle className="h-4 w-4 text-red-300"/>}
                             </div>
                             <div className="min-w-0">
                                <div className="text-xs font-semibold truncate w-full sm:w-[100px]">{item.name}</div>
                                <div className="text-[10px] text-muted-foreground truncate w-full sm:w-[100px]">{item.p_id}</div>
                             </div>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                             <span className="text-red-600 font-bold text-xs">เหลือ {item.available}</span>
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
              <div className="px-4 py-3 border-b bg-muted/10 shrink-0 flex items-center justify-between">
                   <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ArrowLeftRight className="h-4 w-4 text-primary" /> รายการล่าสุด
                   </CardTitle>
                   <Button variant="link" size="sm" asChild className="h-auto p-0 text-[10px]">
                      <a href="/transactions">ดูทั้งหมด</a>
                   </Button>
              </div>
              <CardContent className="p-0 flex-1 flex flex-col justify-between">
                 <div className="divide-y">
                    {transactionsLoading ? Array.from({length:5}).map((_,i)=><div key={i} className="p-3"><Skeleton className="h-8 w-full"/></div>) :
                     paginatedTransactions.length > 0 ? paginatedTransactions.map(tx => (
                       <div key={tx.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors h-[68px]">
                          <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                             <Avatar className="h-8 w-8 border shrink-0">
                                <AvatarFallback className="text-[10px] bg-primary/5 text-primary">
                                   {tx.employees?.name?.substring(0,2) || 'UK'}
                                </AvatarFallback>
                             </Avatar>
                             <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-xs font-medium truncate">{tx.employees?.name || '-'}</span>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground min-w-0">
                                   <span className={cn("px-1 rounded-[2px] shrink-0", tx.status === 'Active' ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700")}>
                                      {tx.status === 'Active' ? 'ยืม' : 'คืน'}
                                   </span>
                                   <span className="truncate">{tx.product_serials?.products?.name}</span>
                                </div>
                             </div>
                          </div>
                          <div className="text-[10px] text-muted-foreground text-right shrink-0 whitespace-nowrap ml-2">
                             {formatDate(tx.created_at)}
                          </div>
                       </div>
                     )) : (
                       <div className="p-8 text-center text-xs text-muted-foreground">ไม่มีรายการเคลื่อนไหว</div>
                     )
                    }
                 </div>
                 
                 <div className="p-2 px-4 border-t bg-muted/5 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                        หน้า {txPage} / {totalTxPages || 1}
                     </span>
                     <div className="flex items-center gap-1">
                        <Button 
                           variant="outline" 
                           size="icon" 
                           className="h-6 w-6" 
                           onClick={() => setTxPage(p => Math.max(1, p - 1))}
                           disabled={txPage === 1}
                        >
                           <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <Button 
                           variant="outline" 
                           size="icon" 
                           className="h-6 w-6"
                           onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))}
                           disabled={txPage === totalTxPages || totalTxPages === 0}
                        >
                           <ChevronRight className="h-3 w-3" />
                        </Button>
                     </div>
                  </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      {/* --- Low Stock Dialog (PORTAL FIX) --- */}
      {isLowStockOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-0 sm:p-6 backdrop-blur-sm animate-in fade-in-0 duration-200">
          <div 
            className="w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] flex flex-col bg-white sm:rounded-xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()} 
          >
            
            {/* Header Dialog */}
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-b bg-red-50 flex flex-col gap-3 shrink-0">
              
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                   <div className="text-base sm:text-lg font-semibold flex items-center gap-2 text-red-700">
                      <AlertTriangle className="h-5 w-5 shrink-0" />
                      สินค้าใกล้หมด
                   </div>
                   <div className="text-xs text-muted-foreground">รายการคงเหลือ &lt; 3 ชิ้น</div>
                </div>
                {/* Mobile Close Button */}
                <Button variant="ghost" size="icon" onClick={() => setIsLowStockOpen(false)} className="sm:hidden -mr-2 -mt-1 h-8 w-8 text-muted-foreground hover:bg-red-100">
                   <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 items-center w-full">
                 <Select value={lowStockCategory} onValueChange={setLowStockCategory}>
                    <SelectTrigger className="w-full sm:w-[140px] h-10 sm:h-9 text-sm sm:text-xs bg-white">
                       <SelectValue placeholder="หมวดหมู่" />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="all">ทั้งหมด</SelectItem>
                       {categoryOptions.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                 </Select>
                 <div className="relative w-full sm:w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                    <Input 
                       placeholder="ค้นหา..." className="h-10 sm:h-9 pl-9 text-sm sm:text-xs w-full bg-white" 
                       value={lowStockSearch} onChange={(e) => setLowStockSearch(e.target.value)}
                    />
                 </div>
                 {/* Desktop Close Button */}
                 <Button variant="ghost" size="icon" onClick={() => setIsLowStockOpen(false)} className="hidden sm:flex ml-auto shrink-0 hover:bg-red-100">
                    <X className="h-4 w-4" />
                 </Button>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-hidden bg-white flex flex-col">
              <ScrollArea className="flex-1">
                 {/* Desktop Table View */}
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
                                   <span className="font-bold text-red-600 text-lg">{item.available}</span>
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

                 {/* Mobile List View */}
                 <div className="sm:hidden divide-y pb-20">
                    {paginatedLowStock.length > 0 ? paginatedLowStock.map(item => (
                       <div key={item.id} className="p-4 flex gap-3">
                          <div className="h-12 w-12 rounded border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                              {item.image ? <img src={item.image} className="h-full w-full object-cover"/> : <ImageIcon className="h-5 w-5 opacity-50"/>}
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-start">
                                <div className="font-medium text-sm truncate pr-2">{item.name}</div>
                                <span className="text-red-600 font-bold text-sm shrink-0">เหลือ {item.available}</span>
                             </div>
                             <div className="text-xs text-muted-foreground truncate">{[item.brand, item.model].filter(Boolean).join(' ')}</div>
                             <div className="flex justify-between items-end mt-1">
                                <Badge variant="secondary" className="text-[10px] h-5">{item.p_id}</Badge>
                                <span className="text-[10px] text-muted-foreground">จากทั้งหมด {item.total}</span>
                             </div>
                          </div>
                       </div>
                    )) : <div className="p-8 text-center text-sm text-muted-foreground">ไม่พบรายการ</div>}
                 </div>
              </ScrollArea>

              <div className="p-4 border-t flex items-center justify-between bg-muted/5 shrink-0 fixed bottom-0 w-full sm:static bg-white sm:bg-transparent z-20 shadow-up sm:shadow-none">
                  <div className="text-xs text-muted-foreground hidden sm:block">
                     หน้า {lowStockPage} จาก {totalLowStockPages}
                  </div>
                  <div className="w-full sm:w-auto flex justify-center">
                     {renderPagination(lowStockPage, setLowStockPage, totalLowStockPages)}
                  </div>
              </div>
            </div>
          </div>
          {/* Background Overlay */}
          <div className="fixed inset-0 -z-10" onClick={() => setIsLowStockOpen(false)} />
        </div>,
        document.body
      )}
    </MainLayout>
  );
}