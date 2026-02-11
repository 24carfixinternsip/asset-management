import { useEffect, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MasterDataConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  entityName: string;
  warningMessage?: string | null;
  isLoading?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function MasterDataConfirmDialog({
  open,
  title,
  description,
  entityName,
  warningMessage,
  isLoading = false,
  onOpenChange,
  onConfirm,
}: MasterDataConfirmDialogProps) {
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (open) {
      setConfirmText("");
    }
  }, [open]);

  const isMatched = confirmText.trim().toLowerCase() === entityName.trim().toLowerCase();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl border-border/70">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-foreground">
            <Trash2 className="h-4 w-4 text-rose-600" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 leading-relaxed text-muted-foreground">
            <p>{description}</p>
            <p>
              รายการที่กำลังลบ: <span className="font-semibold text-foreground">{entityName}</span>
            </p>
            {warningMessage ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <div className="inline-flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  คำเตือน
                </div>
                <p className="mt-1">{warningMessage}</p>
              </div>
            ) : null}
            <div className="space-y-2 pt-1">
              <Label htmlFor="confirm-delete">พิมพ์ชื่อรายการเพื่อยืนยัน</Label>
              <Input
                id="confirm-delete"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder={entityName}
                className="h-10 rounded-xl"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction
            disabled={!isMatched || isLoading}
            className="bg-rose-600 text-white hover:bg-rose-700"
            onClick={(event) => {
              event.preventDefault();
              if (isMatched) {
                onConfirm();
              }
            }}
          >
            {isLoading ? "กำลังลบ..." : "ลบข้อมูล"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
