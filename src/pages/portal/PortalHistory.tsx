import { useMemo, useState } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Filter,
  Package,
  RotateCcw,
  SearchX,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginationControl } from "@/components/ui/pagination-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  TX_STATUS,
  getTransactionStatusLabelTH,
  isReturnedLikeStatus,
  normalizeTransactionStatus,
  type TransactionStatus,
} from "@/constants/transactionStatus";
import { useMyHistory, useRequestReturn } from "@/hooks/useTransactions";
import { cn } from "@/lib/utils";

type HistoryItem = {
  id: string;
  serial_id?: string | null;
  status?: string | null;
  note?: string | null;
  borrow_date?: string | null;
  return_date?: string | null;
  created_at?: string | null;
  product_serials?: {
    serial_code?: string | null;
    products?: {
      name?: string | null;
      brand?: string | null;
      model?: string | null;
      image_url?: string | null;
    } | null;
  } | null;
};

type StatusFilter = "all" | "returned_like" | TransactionStatus;

type StatusMeta = {
  label: string;
  className: string;
  icon: LucideIcon;
};

const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "ทุกสถานะ" },
  { value: TX_STATUS.ACTIVE, label: "กำลังยืม" },
  { value: TX_STATUS.PENDING, label: "รออนุมัติ" },
  { value: "returned_like", label: "คืนแล้ว" },
  { value: TX_STATUS.REJECTED, label: "ถูกปฏิเสธ" },
  { value: TX_STATUS.CANCELLED, label: "ยกเลิก" },
];

const statusMeta: Record<TransactionStatus, StatusMeta> = {
  [TX_STATUS.ACTIVE]: {
    label: "กำลังยืม",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: RotateCcw,
  },
  [TX_STATUS.PENDING]: {
    label: "รออนุมัติ",
    className: "border-slate-200 bg-slate-100 text-slate-700",
    icon: Clock3,
  },
  [TX_STATUS.REJECTED]: {
    label: "ถูกปฏิเสธ",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    icon: XCircle,
  },
  [TX_STATUS.COMPLETED]: {
    label: "คืนแล้ว",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  [TX_STATUS.RETURNED]: {
    label: "คืนแล้ว",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  [TX_STATUS.CANCELLED]: {
    label: "ยกเลิก",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    icon: AlertTriangle,
  },
};

const MAX_RETURN_NOTE_LENGTH = 500;

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatHistoryDate = (value?: string | null, pattern = "d MMM yyyy") => {
  const parsed = parseDate(value);
  if (!parsed) return "-";
  return format(parsed, pattern, { locale: th });
};

const getStatusMeta = (status?: string | null) => {
  const normalized = normalizeTransactionStatus(status);

  if (!normalized) {
    return {
      label: getTransactionStatusLabelTH(status),
      className: "border-slate-200 bg-slate-100 text-slate-700",
      icon: Clock3,
    } satisfies StatusMeta;
  }

  return statusMeta[normalized];
};

export default function PortalHistory() {
  const reduceMotion = useReducedMotion();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [returnDialogItem, setReturnDialogItem] = useState<HistoryItem | null>(null);
  const [returnNote, setReturnNote] = useState("");

  const pageSize = 10;
  const requestReturn = useRequestReturn();

  const {
    data: historyData,
    isLoading,
    isFetching,
    refetch: refetchHistory,
  } = useMyHistory(page, pageSize);

  const transactions = (historyData?.data ?? []) as HistoryItem[];
  const totalPages = historyData?.totalPages || 0;
  const noteLength = returnNote.length;
  const isReturnNoteTooLong = noteLength > MAX_RETURN_NOTE_LENGTH;

  const filteredTransactions = useMemo(() => {
    const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    return transactions.filter((tx) => {
      const normalizedStatus = normalizeTransactionStatus(tx.status);

      if (statusFilter !== "all") {
        if (statusFilter === "returned_like") {
          if (!isReturnedLikeStatus(tx.status)) return false;
        } else if (normalizedStatus !== statusFilter) {
          return false;
        }
      }

      if (!fromDate && !toDate) return true;

      const transactionDate = parseDate(tx.borrow_date || tx.created_at);
      if (!transactionDate) return false;

      if (fromDate && transactionDate < fromDate) return false;
      if (toDate && transactionDate > toDate) return false;

      return true;
    });
  }, [transactions, statusFilter, dateFrom, dateTo]);

  const summaryCards = useMemo(
    () => [
      {
        id: "all",
        label: "ทั้งหมด",
        value: filteredTransactions.length,
        hint: "รายการที่แสดง",
        valueClassName: "text-slate-900",
        icon: Boxes,
      },
      {
        id: "active",
        label: "กำลังยืม",
        value: filteredTransactions.filter((item) => normalizeTransactionStatus(item.status) === TX_STATUS.ACTIVE).length,
        hint: "ยังถือครองอยู่",
        valueClassName: "text-amber-600",
        icon: RotateCcw,
      },
      {
        id: "pending",
        label: "รออนุมัติ",
        value: filteredTransactions.filter((item) => normalizeTransactionStatus(item.status) === TX_STATUS.PENDING).length,
        hint: "รอผู้อนุมัติ",
        valueClassName: "text-slate-600",
        icon: Clock3,
      },
      {
        id: "completed",
        label: "คืนแล้ว",
        value: filteredTransactions.filter((item) => isReturnedLikeStatus(item.status)).length,
        hint: "รายการปิดงาน",
        valueClassName: "text-emerald-600",
        icon: CheckCircle2,
      },
    ],
    [filteredTransactions],
  );

  const closeReturnDialog = () => {
    if (requestReturn.isPending) return;
    setReturnDialogItem(null);
    setReturnNote("");
  };

  const handleOpenReturnDialog = (item: HistoryItem) => {
    setReturnDialogItem(item);
    setReturnNote("");
  };

  const handleConfirmReturn = async () => {
    if (!returnDialogItem?.serial_id || requestReturn.isPending || isReturnNoteTooLong) {
      return;
    }

    try {
      await requestReturn.mutateAsync({
        serialId: returnDialogItem.serial_id,
        returnNote: returnNote.trim(),
      });

      setReturnDialogItem(null);
      setReturnNote("");
      await refetchHistory();
    } catch (error) {
      console.error("[PortalHistory] return action failed", error);
    }
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="portal-shell space-y-6 px-4 pb-6 sm:px-0">
      <motion.section
        className="portal-stagger relative overflow-hidden rounded-[28px] border border-white/70 bg-gradient-to-br from-white via-orange-50/70 to-amber-100/35 p-5 shadow-[0_18px_55px_-34px_rgba(15,23,42,0.55)] sm:p-7"
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={reduceMotion ? undefined : { duration: 0.32 }}
      >
        <div className="pointer-events-none absolute -right-28 -top-24 h-72 w-72 rounded-full bg-orange-200/45 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-[-7.5rem] h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />

        <div className="relative space-y-5">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-white/85 px-3 py-1 text-xs font-medium text-orange-700">
              <Sparkles className="h-3.5 w-3.5" />
              Borrow Tracking
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">ประวัติการเบิกของฉัน</h2>
            <p className="mt-1 text-sm text-slate-600">ติดตามรายการยืม-คืน พร้อมสถานะล่าสุดและข้อมูลคืนสินค้าแบบเรียลไทม์</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.article
                  key={item.id}
                  className="rounded-2xl border border-white/80 bg-white/85 p-3.5 shadow-sm backdrop-blur"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={reduceMotion ? undefined : { duration: 0.24, delay: 0.08 + index * 0.05 }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className={cn("mt-1 text-2xl font-semibold", item.valueClassName)}>{item.value}</p>
                    </div>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/80 bg-slate-100/70 text-slate-600">
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{item.hint}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </motion.section>

      <Card className="portal-glass-card border-border/70 shadow-sm">
        <CardHeader className="space-y-3 pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>สถานะ</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((option) => {
                  const isActive = statusFilter === option.value;
                  return (
                    <Button
                      key={option.value}
                      type="button"
                      variant="outline"
                      className={cn(
                        "h-9 rounded-full border-slate-300 bg-white px-4 text-xs",
                        isActive && "border-primary bg-orange-50 text-primary",
                      )}
                      onClick={() => setStatusFilter(option.value)}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="history-date-from">ตั้งแต่วันที่</Label>
              <Input id="history-date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="history-date-to">ถึงวันที่</Label>
              <Input id="history-date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>

            <div className="flex items-end gap-2">
              <Button type="button" variant="outline" className="h-10 w-full" onClick={resetFilters}>
                <Filter className="h-4 w-4" />
                ล้างตัวกรอง
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="portal-glass-card border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">ทั้งหมด {filteredTransactions.length} รายการ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-3 pb-4 sm:px-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((row) => (
                <Skeleton key={row} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <motion.div
              className="rounded-xl border border-dashed bg-slate-50/60 py-14 text-center"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            >
              <SearchX className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-medium">ไม่พบรายการตามเงื่อนไขที่เลือก</p>
              <p className="text-xs text-muted-foreground">ลองเปลี่ยนตัวกรองหรือช่วงวันที่</p>
            </motion.div>
          ) : (
            <>
              <div className="hidden md:block">
                <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[360px]">รายการ</TableHead>
                        <TableHead>วันที่ยืม</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead>หมายเหตุ</TableHead>
                        <TableHead className="w-[160px] text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((tx) => {
                        const status = getStatusMeta(tx.status);
                        const StatusIcon = status.icon;
                        const isReturnable =
                          normalizeTransactionStatus(tx.status) === TX_STATUS.ACTIVE &&
                          Boolean(tx.serial_id);

                        return (
                          <TableRow
                            key={tx.id}
                            className="motion-safe:transition-colors motion-safe:duration-200 hover:bg-orange-50/50"
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-12 w-12 overflow-hidden rounded-xl border bg-slate-100">
                                  {tx.product_serials?.products?.image_url ? (
                                    <img
                                      src={tx.product_serials.products.image_url}
                                      alt={tx.product_serials.products.name || "Product"}
                                      loading="lazy"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center">
                                      <Package className="h-5 w-5 text-slate-400" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="line-clamp-1 text-sm font-semibold">
                                    {tx.product_serials?.products?.name || "Unknown item"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {tx.product_serials?.products?.brand || "-"}
                                    {tx.product_serials?.products?.model
                                      ? ` ${tx.product_serials.products.model}`
                                      : ""}
                                  </p>
                                  <p className="font-mono text-xs text-muted-foreground">
                                    {tx.product_serials?.serial_code || "-"}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatHistoryDate(tx.borrow_date || tx.created_at)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("gap-1", status.className)}>
                                <StatusIcon className="h-3.5 w-3.5" />
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[260px]">
                              <p className="line-clamp-2 text-xs text-muted-foreground">{tx.note || "-"}</p>
                            </TableCell>
                            <TableCell className="text-right">
                              {isReturnable ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl border-slate-300 bg-white"
                                  onClick={() => handleOpenReturnDialog(tx)}
                                  disabled={requestReturn.isPending}
                                  aria-label={`คืนสินค้า ${tx.product_serials?.products?.name || "รายการนี้"}`}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  คืนสินค้า
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="space-y-3 md:hidden">
                <AnimatePresence initial={false}>
                  {filteredTransactions.map((tx, index) => {
                    const status = getStatusMeta(tx.status);
                    const StatusIcon = status.icon;
                    const isReturnable =
                      normalizeTransactionStatus(tx.status) === TX_STATUS.ACTIVE &&
                      Boolean(tx.serial_id);

                    return (
                      <motion.article
                        key={tx.id}
                        className="portal-flash-card rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
                        initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.99 }}
                        animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                        transition={reduceMotion ? undefined : { duration: 0.2, delay: index * 0.03 }}
                        whileHover={reduceMotion ? undefined : { y: -2 }}
                      >
                        <div className="flex gap-3">
                          <div className="h-16 w-16 overflow-hidden rounded-xl border bg-slate-100">
                            {tx.product_serials?.products?.image_url ? (
                              <img
                                src={tx.product_serials.products.image_url}
                                alt={tx.product_serials.products.name || "Product"}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Package className="h-6 w-6 text-slate-400" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="space-y-1">
                              <p className="line-clamp-2 text-sm font-semibold">
                                {tx.product_serials?.products?.name || "Unknown item"}
                              </p>
                              <p className="font-mono text-xs text-muted-foreground">
                                {tx.product_serials?.serial_code || "-"}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <CalendarClock className="h-3.5 w-3.5" />
                              {formatHistoryDate(tx.borrow_date || tx.created_at, "d MMM yyyy HH:mm")}
                            </div>

                            <Badge variant="outline" className={cn("gap-1", status.className)}>
                              <StatusIcon className="h-3.5 w-3.5" />
                              {status.label}
                            </Badge>

                            {tx.note ? <p className="line-clamp-2 text-xs text-muted-foreground">{tx.note}</p> : null}

                            {isReturnable ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full rounded-xl border-slate-300 bg-white"
                                onClick={() => handleOpenReturnDialog(tx)}
                                disabled={requestReturn.isPending}
                                aria-label={`คืนสินค้า ${tx.product_serials?.products?.name || "รายการนี้"}`}
                              >
                                <RotateCcw className="h-4 w-4" />
                                คืนสินค้า
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              </div>

              {totalPages > 1 ? (
                <div className="pt-2">
                  <PaginationControl currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                </div>
              ) : null}
            </>
          )}

          {isFetching && !isLoading ? (
            <p className="text-right text-xs text-muted-foreground">กำลังรีเฟรชข้อมูล...</p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(returnDialogItem)}
        onOpenChange={(open) => {
          if (!open) closeReturnDialog();
        }}
      >
        <DialogContent
          className="max-w-lg rounded-2xl border border-white/80 bg-white/95 p-0 shadow-2xl"
          onEscapeKeyDown={(event) => {
            if (requestReturn.isPending) {
              event.preventDefault();
            }
          }}
        >
          <motion.form
            className="space-y-5 p-6"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
            animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }}
            transition={reduceMotion ? undefined : { duration: 0.2 }}
            onSubmit={(event) => {
              event.preventDefault();
              void handleConfirmReturn();
            }}
          >
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-xl">ยืนยันคืนสินค้า</DialogTitle>
              <p className="text-sm text-muted-foreground">ตรวจสอบข้อมูลรายการก่อนบันทึกการคืนสินค้า</p>
            </DialogHeader>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5">
              <div className="flex gap-3">
                <div className="h-16 w-16 overflow-hidden rounded-xl border bg-white">
                  {returnDialogItem?.product_serials?.products?.image_url ? (
                    <img
                      src={returnDialogItem.product_serials.products.image_url}
                      alt={returnDialogItem.product_serials.products.name || "Product"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-100">
                      <Package className="h-6 w-6 text-slate-400" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                    {returnDialogItem?.product_serials?.products?.name || "Unknown item"}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {returnDialogItem?.product_serials?.serial_code || "-"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    วันที่ยืม: {formatHistoryDate(returnDialogItem?.borrow_date || returnDialogItem?.created_at, "d MMM yyyy HH:mm")}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="return-note">หมายเหตุ (ถ้ามี)</Label>
              <Textarea
                id="return-note"
                aria-label="หมายเหตุการคืนสินค้า"
                value={returnNote}
                onChange={(event) => setReturnNote(event.target.value)}
                placeholder="ระบุสภาพสินค้า อุปกรณ์เสริม หรือรายละเอียดเพิ่มเติม"
                rows={4}
                disabled={requestReturn.isPending}
              />

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">ข้อมูลนี้จะถูกบันทึกในประวัติการยืม-คืน</span>
                <span
                  className={cn("font-medium", isReturnNoteTooLong ? "text-rose-600" : "text-muted-foreground")}
                  aria-live="polite"
                >
                  {noteLength}/{MAX_RETURN_NOTE_LENGTH}
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={closeReturnDialog}
                disabled={requestReturn.isPending}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-[#F15A24] to-[#ff7a2f] text-white hover:from-[#dd4f1a] hover:to-[#ef6c24]"
                disabled={requestReturn.isPending || isReturnNoteTooLong || !returnDialogItem?.serial_id}
                aria-label="ยืนยันคืนสินค้า"
              >
                {requestReturn.isPending ? "กำลังบันทึก..." : "ยืนยันคืนสินค้า"}
              </Button>
            </DialogFooter>
          </motion.form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
