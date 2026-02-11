import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface SegmentedTabItem {
  value: string;
  label: string;
  helper?: string;
}

interface SegmentedTabsProps {
  value: string;
  items: SegmentedTabItem[];
  onValueChange: (value: string) => void;
  className?: string;
}

export function SegmentedTabs({ value, items, onValueChange, className }: SegmentedTabsProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="overflow-x-auto pb-1">
        <TabsList className="flex h-auto min-w-full items-center gap-1 rounded-2xl border border-border/70 bg-card/85 p-1 sm:grid sm:grid-cols-3 sm:gap-1.5">
          {items.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              onClick={() => onValueChange(item.value)}
              className="group min-w-[132px] rounded-xl px-4 py-2.5 text-left text-sm font-medium leading-tight transition-all duration-200 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:min-w-0"
            >
              <span className="block truncate text-sm font-semibold">{item.label}</span>
              {item.helper ? (
                <span className="mt-1 block truncate text-[11px] leading-tight text-muted-foreground">
                  {item.helper}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </div>
  );
}
