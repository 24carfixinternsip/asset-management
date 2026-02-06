import { useState, useEffect } from "react";
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
import { Trash2 } from "lucide-react";

interface SafeDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
  itemType: string;
  isLoading: boolean;
}

export function SafeDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType,
  isLoading,
}: SafeDeleteDialogProps) {
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (isOpen) setConfirmText("");
  }, [isOpen]);

  const isMatch = confirmText.trim().toLowerCase() === itemName.trim().toLowerCase();

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            ยืนยันการลบ{itemType}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <div>
              คุณกำลังจะลบ <strong>"{itemName}"</strong> ออกจากระบบอย่างถาวร
              <br />
              การกระทำนี้ไม่สามารถเรียกคืนได้
            </div>
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive font-medium">
              คำเตือน: หากข้อมูลนี้ถูกใช้งานอยู่ ระบบจะไม่อนุญาตให้ลบ
            </div>
            <div className="space-y-2 pt-2">
              <Label htmlFor="confirm-delete" className="text-foreground">
                พิมพ์ชื่อ "{itemName}" เพื่อยืนยัน
              </Label>
              <Input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={itemName}
                className="border-destructive/50 focus-visible:ring-destructive"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              if (isMatch) onConfirm();
            }}
            disabled={!isMatch || isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "กำลังลบ..." : "ลบข้อมูลทันที"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
