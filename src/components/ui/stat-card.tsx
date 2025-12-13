import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
  className?: string;
}

const variantStyles = {
  default: {
    icon: 'bg-muted text-muted-foreground',
  },
  primary: {
    icon: 'bg-primary/10 text-primary',
  },
  success: {
    icon: 'bg-success/10 text-success',
  },
  warning: {
    icon: 'bg-warning/10 text-warning',
  },
  destructive: {
    icon: 'bg-destructive/10 text-destructive',
  },
};

export function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  trend,
  variant = 'default',
  className 
}: StatCardProps) {
  return (
    <Card className={cn("transition-all duration-200 hover:shadow-md", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {trend && (
              <p className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-success" : "text-destructive"
              )}>
                {trend.isPositive ? "+" : ""}{trend.value}% จากเดือนก่อน
              </p>
            )}
          </div>
          <div className={cn(
            "flex h-14 w-14 items-center justify-center rounded-xl",
            variantStyles[variant].icon
          )}>
            <Icon className="h-7 w-7" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
