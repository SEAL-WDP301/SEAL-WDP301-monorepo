import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-orange-500/30 bg-orange-500/10 text-orange-400",

        success:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",

        warning:
          "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",

        destructive:
          "border-red-500/30 bg-red-500/10 text-red-400",

        ai:
          "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",

        cloud:
          "border-orange-500/30 bg-orange-500/10 text-orange-400",

        cyber:
          "border-red-500/30 bg-red-500/10 text-red-400",

        edtech:
          "border-purple-500/30 bg-purple-500/10 text-purple-400",

        web3:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",

        outline:
          "border-white/10 bg-white/[0.03] text-muted-foreground",

        highlight:
          "border-orange-500/40 bg-orange-500/10 text-orange-400"
      },
    },

    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> { }

function Badge({
  className,
  variant,
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };