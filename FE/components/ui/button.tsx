import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "text-foreground hover:bg-accent hover:text-accent-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        orange:
          "bg-orange-500 text-foreground shadow-lg shadow-orange-500/15 hover:bg-orange-400 focus-visible:ring-orange-500/30",
        link:
          "h-auto p-0 text-primary underline-offset-4 hover:underline",
        glass:
          "border border-border bg-card text-foreground backdrop-blur-xl hover:bg-muted",
        soft:
          "bg-primary/10 text-primary hover:bg-primary/20",
        authPrimary:
          "rounded-[2rem] bg-[linear-gradient(180deg,#ff873f,#ff6f22)] text-black shadow-[0_18px_50px_rgba(255,112,34,0.28)] hover:brightness-110 focus-visible:ring-4 focus-visible:ring-[#ff7629]/30 active:translate-y-px",
        authSecondary:
          "rounded-[2rem] border border-border bg-background/70 text-foreground hover:border-[#ff7629]/50 hover:bg-muted focus-visible:ring-4 focus-visible:ring-[#ff7629]/20 active:translate-y-px dark:border-white/15 dark:bg-white/[0.025] dark:hover:bg-white/[0.05]",
        subtleIcon:
          "text-[#aa9b93] hover:text-primary",
        eventTab:
          "rounded-2xl text-[#8E827C] hover:bg-white/[0.02] hover:text-foreground",
        eventTabActive:
          "rounded-2xl border border-[#FF6B2C]/30 bg-[#1A1512] text-[#FF6B2C] shadow-[0_4px_20px_rgba(255,107,44,0.08)]",
        eventCta:
          "rounded-2xl bg-[#FF6B2C] text-foreground uppercase tracking-wider shadow-lg shadow-[#FF6B2C]/10 hover:bg-[#ff7b42]",
        eventOutline:
          "rounded-2xl border border-white/[0.06] text-[#A39690] hover:bg-white/[0.02] hover:text-foreground",
        eventBack:
          "group rounded-xl border border-white/[0.06] bg-white/[0.02] text-[#A39690] hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-foreground active:scale-[0.98]",
        dashboardIcon:
          "rounded-2xl border border-border bg-card text-foreground hover:bg-muted",
        socialIcon:
          "rounded-xl border border-border bg-card text-muted-foreground hover:border-orange-500 hover:bg-orange-500 hover:text-foreground",
        seasonGradient:
          "rounded-xl text-foreground hover:gap-3 hover:shadow-xl",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        auto: "h-auto gap-2",
        auth: "h-11 px-4 py-2 gap-2 rounded-xl text-sm sm:text-base",
        eventCta: "h-12 gap-2 px-6 text-sm",
        eventTab: "h-11 gap-2 px-5 text-sm",
        eventBack: "h-10 gap-2 px-4 text-sm",
        icon: "size-8",
        dashboardIcon: "size-11",
        socialIcon: "size-10",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<typeof ButtonPrimitive> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : ButtonPrimitive
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
