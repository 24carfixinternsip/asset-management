import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, History, Search, X, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { useTransactions, useCreateTransaction, useReturnTransaction, useApproveRequest, useRejectRequest, Transaction } from "@/hooks/useTransactions";
import { useEmployees, useDepartments } from "@/hooks/useMasterData";
import { cn } from "@/lib/utils";

// Components
import { TransactionList } from "@/components/transactions/TransactionList";
import { BorrowTab } from "@/components/transactions/BorrowTab";
import { ViewTransactionDialog, ReturnDialog, ApproveDialog } from "@/components/transactions/TransactionDialogs";

type TransactionTab = "pending" | "borrow" | "active" | "history";
type FilterType = "all" | "employee" | "department";

const TRANSACTION_TABS: readonly TransactionTab[] = ["pending", "borrow", "active", "history"];

const isTransactionTab = (value: string | null): value is TransactionTab =>
  value !== null && TRANSACTION_TABS.includes(value as TransactionTab);

const isFilterType = (value: string): value is FilterType =>
  value === "all" || value === "employee" || value === "department";

interface ActiveIndicatorRect {
  left: number;
  top: number;
  width: number;
  height: number;
  ready: boolean;
}

const INDICATOR_INSET = 2;

export default function Transactions() {
  // ประกาศตัวแปร URL Params
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab State
  const [currentTab, setCurrentTab] = useState<TransactionTab>(() => {
    const tabParam = searchParams.get("tab");
    return isTransactionTab(tabParam) ? tabParam : "pending";
  });

  // Tabs UI refs/state (active indicator is measured from the active trigger rect).
  const tabsClipRef = useRef<HTMLDivElement | null>(null);
  const tabTriggerRefs = useRef<Record<TransactionTab, HTMLButtonElement | null>>({
    pending: null,
    borrow: null,
    active: null,
    history: null,
  });
  const [activeIndicatorRect, setActiveIndicatorRect] = useState<ActiveIndicatorRect>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  // Pagination States (ap = active page, hp = history page)
  const [activePage, setActivePage] = useState(Number(searchParams.get("ap")) || 1);
  const [historyPage, setHistoryPage] = useState(Number(searchParams.get("hp")) || 1);
  const [pendingPage, setPendingPage] = useState(Number(searchParams.get("pp")) || 1);

  // Filter States (Active Loans Tab)
  const [filterType, setFilterType] = useState<FilterType>(
    isFilterType(searchParams.get("type") || "") ? (searchParams.get("type") as FilterType) : "all"
  );
  const [filterId, setFilterId] = useState<string>(searchParams.get("id") || ''); 
  const [activeSearch, setActiveSearch] = useState(searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState<'all' | Transaction['status']>('all');
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | '90d'>('all');
  
  // Dialog States
  const [returnDialog, setReturnDialog] = useState<{ open: boolean; tx: Transaction | null }>({ open: false, tx: null });
  const [viewDialog, setViewDialog] = useState<{ open: boolean; tx: Transaction | null }>({ open: false, tx: null });
  const [approveDialog, setApproveDialog] = useState<{ open: boolean; tx: Transaction | null }>({ open: false, tx: null });

  // Hooks & Data 
  const { data: activeData, isLoading: activeLoading } = useTransactions('Active', activePage);
  const { data: historyData, isLoading: completedLoading } = useTransactions('Completed', historyPage);
  const { data: pendingData, isLoading: pendingLoading } = useTransactions('Pending', pendingPage);

  const { data: employees } = useEmployees();
  const { data: departments } = useDepartments(); 
  
  const createTransaction = useCreateTransaction();
  const returnTransaction = useReturnTransaction();
  const approveRequest = useApproveRequest();
  const rejectRequest = useRejectRequest();

  // Extract Arrays
  const activeTransactions = activeData?.data || [];
  const completedTransactions = historyData?.data || [];
  const pendingTransactions = pendingData?.data || [];

  const employeeOptions = employees?.map((e) => ({ value: e.id, label: e.name })) || [];
  const departmentOptions = departments?.map((d) => ({ value: d.id, label: d.name })) || [];

  const statusOptions = [
    { value: "Pending", label: "รออนุมัติ" },
    { value: "Active", label: "อนุมัติแล้ว" },
    { value: "Completed", label: "คืนแล้ว" },
    { value: "Rejected", label: "ปฏิเสธ" },
  ];

  const dateOptions = [
    { value: "all", label: "ทุกช่วงเวลา" },
    { value: "7d", label: "7 วันล่าสุด" },
    { value: "30d", label: "30 วันล่าสุด" },
    { value: "90d", label: "90 วันล่าสุด" },
  ];

  const statusFilterValue = statusFilter;

  const setTabTriggerRef = useCallback(
    (tab: TransactionTab) => (node: HTMLButtonElement | null) => {
      tabTriggerRefs.current[tab] = node;
    },
    []
  );

  const updateActiveIndicator = useCallback(() => {
    const tabsClip = tabsClipRef.current;
    const activeTrigger = tabTriggerRefs.current[currentTab];
    if (!tabsClip || !activeTrigger) return;

    const clipRect = tabsClip.getBoundingClientRect();
    const triggerRect = activeTrigger.getBoundingClientRect();

    const dpr = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
    const snap = (value: number) => Math.round(value * dpr) / dpr;

    const left = triggerRect.left - clipRect.left + INDICATOR_INSET;
    const top = triggerRect.top - clipRect.top + INDICATOR_INSET;
    const width = triggerRect.width - INDICATOR_INSET * 2;
    const height = triggerRect.height - INDICATOR_INSET * 2;

    const nextRect: ActiveIndicatorRect = {
      left: snap(Math.max(0, left)),
      top: snap(Math.max(0, top)),
      width: snap(Math.max(0, width)),
      height: snap(Math.max(0, height)),
      ready: width > 0 && height > 0,
    };

    setActiveIndicatorRect((prev) => {
      if (
        Math.abs(prev.left - nextRect.left) < 0.25 &&
        Math.abs(prev.top - nextRect.top) < 0.25 &&
        Math.abs(prev.width - nextRect.width) < 0.25 &&
        Math.abs(prev.height - nextRect.height) < 0.25 &&
        prev.ready === nextRect.ready
      ) {
        return prev;
      }
      return nextRect;
    });
  }, [currentTab]);

  useLayoutEffect(() => {
    updateActiveIndicator();
  }, [updateActiveIndicator]);

  useEffect(() => {
    const onResize = () => updateActiveIndicator();
    window.addEventListener("resize", onResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => updateActiveIndicator());
      const clipNode = tabsClipRef.current;
      if (clipNode) resizeObserver.observe(clipNode);
      TRANSACTION_TABS.forEach((tab) => {
        const node = tabTriggerRefs.current[tab];
        if (node) resizeObserver?.observe(node);
      });
    }

    return () => {
      window.removeEventListener("resize", onResize);
      resizeObserver?.disconnect();
    };
  }, [updateActiveIndicator]);

  const handleTabChange = useCallback((value: string) => {
    if (isTransactionTab(value)) {
      setCurrentTab(value);
    }
  }, []);

  const handleStatusFilterChange = useCallback((value: "all" | Transaction["status"]) => {
    setStatusFilter(value);
    if (value === "Pending") setCurrentTab("pending");
    if (value === "Active") setCurrentTab("active");
    if (value === "Completed") setCurrentTab("history");
  }, []);

  // Logic: URL Synchronization 
  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    // Tab
    params.set("tab", currentTab);

    // Pagination
    if (activePage > 1) params.set("ap", activePage.toString());
    else params.delete("ap");

    if (historyPage > 1) params.set("hp", historyPage.toString());
    else params.delete("hp");

    if (pendingPage > 1) params.set("pp", pendingPage.toString());
    else params.delete("pp");

    // Filters (เฉพาะ Tab Active)
    if (currentTab === 'active') {
        if (filterType !== 'all') params.set("type", filterType);
        else params.delete("type");

        if (filterId) params.set("id", filterId);
        else params.delete("id");

        if (activeSearch) params.set("q", activeSearch);
        else params.delete("q");
    }

    setSearchParams(params, { replace: true });
  }, [currentTab, activePage, historyPage, pendingPage, filterType, filterId, activeSearch, setSearchParams]);

  // Reset Page when filters change
  useEffect(() => {
    setActivePage(1);
    setPendingPage(1);
    setHistoryPage(1);
  }, [filterType, filterId, activeSearch, dateFilter]);


  // Filtering Logic
  const isWithinDateRange = (dateStr: string) => {
    if (dateFilter === "all") return true;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    const limit = dateFilter === "7d" ? 7 : dateFilter === "30d" ? 30 : 90;
    return diffDays <= limit;
  };

  const matchesQuickFilters = (tx: Transaction) => {
    let matchesEntity = true;
    if (filterType === "employee" && filterId) matchesEntity = tx.employee_id === filterId;
    else if (filterType === "department" && filterId) {
      matchesEntity = tx.department_id === filterId || tx.employees?.department_id === filterId;
    }

    const searchLower = activeSearch.trim().toLowerCase();
    const searchPool = [
      tx.product_serials?.serial_code,
      tx.product_serials?.products?.name,
      tx.product_serials?.products?.model,
      tx.employees?.name,
      tx.departments?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch = !searchLower || searchPool.includes(searchLower);

    const matchesDate = isWithinDateRange(tx.borrow_date || tx.created_at);
    const matchesStatus = statusFilterValue === "all" ? true : tx.status === statusFilterValue;

    return matchesEntity && matchesSearch && matchesDate && matchesStatus;
  };

  const filteredPendingTransactions = useMemo(
    () => pendingTransactions.filter(matchesQuickFilters),
    [pendingTransactions, filterType, filterId, activeSearch, dateFilter, statusFilterValue]
  );
  const filteredActiveTransactions = useMemo(
    () => activeTransactions.filter(matchesQuickFilters),
    [activeTransactions, filterType, filterId, activeSearch, dateFilter, statusFilterValue]
  );
  const filteredHistoryTransactions = useMemo(
    () => completedTransactions.filter(matchesQuickFilters),
    [completedTransactions, filterType, filterId, activeSearch, dateFilter, statusFilterValue]
  );

  const requesterOptions =
    filterType === "employee" ? employeeOptions : filterType === "department" ? departmentOptions : [];

  const activeFiltersCount =
    (activeSearch.trim() ? 1 : 0) + (filterType !== "all" && filterId ? 1 : 0) + (dateFilter !== "all" ? 1 : 0);

  // Actions
  const handleReturnConfirm = async (condition: string, note: string) => {
    if (!returnDialog.tx) return;
    await returnTransaction.mutateAsync({ 
      transactionId: returnDialog.tx.id, 
      condition: condition, 
      note: note 
    });
    setReturnDialog({ open: false, tx: null });
  };

  // Handler สำหรับอนุมัติ
  const handleApprove = async (transactionId: string) => {
    await approveRequest.mutateAsync({ transactionId });
    setApproveDialog({ open: false, tx: null });
  };

  // Handler สำหรับปฏิเสธ
  const handleReject = async (transactionId: string, reason: string) => {
    await rejectRequest.mutateAsync({ transactionId, reason });
    setApproveDialog({ open: false, tx: null });
  };

  const renderPagination = (currentPage: number, setPage: (p: number) => void, totalPages: number) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-end gap-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="h-8 rounded-full px-3 text-xs"
        >
          <ChevronLeft className="h-4 w-4" /> ก่อนหน้า
        </Button>
        <span className="text-xs text-muted-foreground">
          หน้า {currentPage} จาก {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="h-8 rounded-full px-3 text-xs"
        >
          ถัดไป <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  const FilterBar = () => (
    <div className="mt-4 rounded-2xl border bg-white/80 p-3 shadow-sm">
      <div className="grid items-end gap-3 lg:grid-cols-12">
        <div className="relative lg:col-span-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหา Serial, ชื่อสินค้า, ผู้เบิก..."
            className="h-11 rounded-full border border-border/70 bg-white pl-10 text-sm shadow-sm transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0"
            value={activeSearch}
            onChange={(e) => setActiveSearch(e.target.value)}
          />
          {activeSearch && (
            <button
              type="button"
              onClick={() => setActiveSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition hover:bg-muted/70 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Select
          value={statusFilterValue}
          onValueChange={(val) => handleStatusFilterChange(val as "all" | Transaction["status"])}
        >
          <SelectTrigger className="h-11 border-border/70 bg-white shadow-sm transition-[box-shadow,background-color] duration-200 focus:ring-primary/30 lg:col-span-2">
            <SelectValue placeholder="สถานะ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateFilter} onValueChange={(val) => setDateFilter(val as 'all' | '7d' | '30d' | '90d')}>
          <SelectTrigger className="h-11 border-border/70 bg-white shadow-sm transition-[box-shadow,background-color] duration-200 focus:ring-primary/30 lg:col-span-2">
            <SelectValue placeholder="ช่วงเวลา" />
          </SelectTrigger>
          <SelectContent>
            {dateOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterType}
          onValueChange={(val) => {
            if (!isFilterType(val)) return;
            setFilterType(val);
            setFilterId("");
          }}
        >
          <SelectTrigger className="h-11 border-border/70 bg-white shadow-sm transition-[box-shadow,background-color] duration-200 focus:ring-primary/30 lg:col-span-2">
            <SelectValue placeholder="ผู้เบิก" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            <SelectItem value="employee">พนักงาน</SelectItem>
            <SelectItem value="department">แผนก</SelectItem>
          </SelectContent>
        </Select>

        <div
          className={cn(
            "lg:col-span-2 [&_button[role=combobox]]:h-11 [&_button[role=combobox]]:rounded-md [&_button[role=combobox]]:border-border/70 [&_button[role=combobox]]:shadow-sm [&_button[role=combobox]]:transition-[box-shadow,background-color,color] [&_button[role=combobox]]:duration-200",
            filterType === "all" && "opacity-50 pointer-events-none"
          )}
        >
          <SearchableSelect
            items={requesterOptions}
            value={filterId}
            onValueChange={setFilterId}
            placeholder={
              filterType === "employee"
                ? "เลือกพนักงาน..."
                : filterType === "department"
                ? "เลือกแผนก..."
                : "เลือกผู้เบิก..."
            }
            disabled={filterType === "all"}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        {activeFiltersCount > 0 ? (
          <span>ตัวกรองที่ใช้งาน {activeFiltersCount} รายการ</span>
        ) : (
          <span>ยังไม่มีการเลือกตัวกรองเพิ่มเติม</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setFilterType("all");
            setFilterId("");
            setActiveSearch("");
            setDateFilter("all");
          }}
          className="h-8 rounded-md px-2.5 text-[11px] motion-safe:transition-colors hover:bg-muted/60"
        >
          ล้างตัวกรอง
        </Button>
      </div>
    </div>
  );

  return (
    <MainLayout title="ระบบเบิก-จ่ายและคืนทรัพย์สิน">
      <div className="space-y-6">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
          <div className="tabsWrap">
            <div className="tabsPill">
              <TabsList ref={tabsClipRef} className="tabsClip" aria-label="หมวดรายการเบิก-คืน">
                {/* Active indicator uses inset shadow instead of border/outline, so it never spills outside the rounded pill. */}
                <span
                  aria-hidden="true"
                  className="activeIndicator"
                  style={{
                    width: `${activeIndicatorRect.width}px`,
                    height: `${activeIndicatorRect.height}px`,
                    transform: `translate3d(${activeIndicatorRect.left}px, ${activeIndicatorRect.top}px, 0)`,
                    opacity: activeIndicatorRect.ready ? 1 : 0,
                  }}
                />

                <TabsTrigger
                  ref={setTabTriggerRef("pending")}
                  value="pending"
                  className="tabBtn data-[state=active]:bg-transparent data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                  <span className="flex h-full w-full min-w-0 flex-col justify-center gap-1">
                    <span className="tabLabel w-full">คำขอเบิก</span>
                    <span className="tabSubtitle w-full">รายการรออนุมัติจากแอดมิน</span>
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  ref={setTabTriggerRef("borrow")}
                  value="borrow"
                  className="tabBtn data-[state=active]:bg-transparent data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                  <span className="flex h-full w-full min-w-0 flex-col justify-center gap-1">
                    <span className="tabLabel w-full">ทำรายการเบิก</span>
                    <span className="tabSubtitle w-full">สร้างรายการเบิกใหม่อย่างรวดเร็ว</span>
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  ref={setTabTriggerRef("active")}
                  value="active"
                  className="tabBtn data-[state=active]:bg-transparent data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                  <span className="flex h-full w-full min-w-0 flex-col justify-center gap-1">
                    <span className="tabLabel w-full">รายการถูกยืม</span>
                    <span className="tabSubtitle w-full">ติดตามรายการที่ยังไม่คืน</span>
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  ref={setTabTriggerRef("history")}
                  value="history"
                  className="tabBtn data-[state=active]:bg-transparent data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                  <span className="flex h-full w-full min-w-0 flex-col justify-center gap-1">
                    <span className="tabLabel w-full">ประวัติย้อนหลัง</span>
                    <span className="tabSubtitle w-full">สรุปรายการเสร็จสิ้นและคืนแล้ว</span>
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Borrow Form */}
          <TabsContent value="borrow">
             <BorrowTab 
                employees={employees} 
                departments={departments} 
                createTransaction={createTransaction} 
             />
          </TabsContent>

          {/* Pending Requests Tab */}
          <TabsContent value="pending">
            <Card className="overflow-hidden border-border/60 shadow-sm">
              <CardHeader className="px-6 pt-6 pb-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <AlertCircle className="h-5 w-5 text-orange-500 shrink-0" />
                      คำขอเบิกรอการอนุมัติ
                    </CardTitle>
                    <CardDescription>รายการที่รออนุมัติจากผู้ดูแลระบบ</CardDescription>
                  </div>
                  <Badge variant="secondary" className="h-6 px-2 text-xs">
                    {filteredPendingTransactions.length} รายการ
                  </Badge>
                </div>
                <FilterBar />
              </CardHeader>
              <div className="p-0">
                <TransactionList
                  data={filteredPendingTransactions}
                  isLoading={pendingLoading}
                  variant="pending"
                  onView={(tx) => setViewDialog({ open: true, tx })}
                  onApprove={(tx) => setApproveDialog({ open: true, tx })}
                />
              </div>
              <CardFooter className="border-t border-border/60 bg-muted/10 p-2 px-6">
                {pendingData && renderPagination(pendingPage, setPendingPage, pendingData.totalPages)}
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Active Loans */}
          <TabsContent value="active">
            <Card className="overflow-hidden border-border/60 shadow-sm">
              <CardHeader className="px-6 pt-6 pb-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Clock className="h-5 w-5 text-warning shrink-0" />
                      รายการที่กำลังถูกยืม
                    </CardTitle>
                    <CardDescription>ติดตามรายการที่ยังไม่คืนและกำหนดการรับคืน</CardDescription>
                  </div>
                  <Badge variant="secondary" className="h-6 px-2 text-xs">
                    {filteredActiveTransactions.length} รายการ
                  </Badge>
                </div>
                <FilterBar />
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
              <CardFooter className="border-t border-border/60 bg-muted/10 p-2 px-6">
                {activeData && renderPagination(activePage, setActivePage, activeData.totalPages)}
              </CardFooter>
            </Card>
          </TabsContent>

          {/* History */}
          <TabsContent value="history">
            <Card className="overflow-hidden border-border/60 shadow-sm">
              <CardHeader className="px-6 pt-6 pb-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <History className="h-5 w-5" />
                      ประวัติย้อนหลัง
                    </CardTitle>
                    <CardDescription>สรุปรายการที่คืนแล้วและปิดงานเรียบร้อย</CardDescription>
                  </div>
                  <Badge variant="secondary" className="h-6 px-2 text-xs">
                    {filteredHistoryTransactions.length} รายการ
                  </Badge>
                </div>
                <FilterBar />
              </CardHeader>
              <div className="p-0">
                <TransactionList
                  data={filteredHistoryTransactions}
                  isLoading={completedLoading}
                  variant="history"
                  onView={(tx) => setViewDialog({ open: true, tx })}
                />
              </div>
              <CardFooter className="border-t border-border/60 bg-muted/10 p-2 px-6">
                {historyData && renderPagination(historyPage, setHistoryPage, historyData.totalPages)}
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <ViewTransactionDialog open={viewDialog.open} onOpenChange={(o) => setViewDialog(prev => ({ ...prev, open: o }))} tx={viewDialog.tx} />
      <ReturnDialog open={returnDialog.open} onOpenChange={(o) => setReturnDialog(prev => ({ ...prev, open: o }))} tx={returnDialog.tx} onConfirm={handleReturnConfirm} isPending={returnTransaction.isPending} />
      <ApproveDialog 
        open={approveDialog.open} 
        onOpenChange={(o) => setApproveDialog(prev => ({ ...prev, open: o }))} 
        tx={approveDialog.tx} 
        onApprove={handleApprove}
        onReject={handleReject}
        isPending={approveRequest.isPending || rejectRequest.isPending}
      />
    </MainLayout>
  );
}
