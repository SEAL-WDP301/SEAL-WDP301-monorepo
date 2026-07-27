"use client";

import { type ComponentProps, type ReactNode, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FieldProps = ComponentProps<"input"> & {
  label: string;
  icon?: ReactNode;
  rightIcon?: ReactNode;
  hideToggle?: boolean;
};

export function AuthField({ label, icon, rightIcon, hideToggle, className, type, ...props }: FieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password" && !hideToggle;
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;

  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-sm">
        {label}
      </span>
      <span className="relative block">
        {icon ? (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
        ) : null}
        <input
          type={inputType}
          className={cn(
            "h-11 w-full rounded-[2rem] border border-input bg-background px-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/70 focus:ring-4 focus:ring-primary/20",
            icon && "pl-12",
            (isPassword || rightIcon) && "pr-12",
            className
          )}
          {...props}
        />
        {isPassword && !rightIcon && (
          <Button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            variant="subtleIcon"
            size="auto"
            className="absolute right-4 top-1/2 -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        )}
        {rightIcon && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            {rightIcon}
          </span>
        )}
      </span>
    </label>
  );
}

type TextAreaProps = ComponentProps<"textarea"> & {
  label: string;
};

export function AuthTextarea({ label, className, ...props }: TextAreaProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-sm">
        {label}
      </span>
      <textarea
        className={cn(
          "min-h-24 w-full resize-none rounded-[1.75rem] border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/70 focus:ring-4 focus:ring-primary/20",
          className
        )}
        {...props}
      />
    </label>
  );
}
