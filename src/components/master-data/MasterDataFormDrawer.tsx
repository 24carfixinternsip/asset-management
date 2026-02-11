import type { ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface MasterDataFormDrawerProps {
  open: boolean;
  title: string;
  description?: string;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function MasterDataFormDrawer({
  open,
  title,
  description,
  onOpenChange,
  children,
}: MasterDataFormDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[92dvh] max-h-[92dvh] rounded-t-3xl border-border/70 p-0">
        <DrawerHeader className="border-b border-border/70 px-4 pb-3 pt-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 text-left">
              <DrawerTitle>{title}</DrawerTitle>
              {description ? <DrawerDescription>{description}</DrawerDescription> : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => onOpenChange(false)}
              aria-label="ปิดฟอร์ม"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-4">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
