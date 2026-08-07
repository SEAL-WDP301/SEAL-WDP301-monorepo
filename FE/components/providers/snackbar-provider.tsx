"use client";

import React, { forwardRef } from "react";
import {
  SnackbarProvider as NotistackProvider,
  CustomContentProps,
  closeSnackbar,
} from "notistack";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

const CustomSnackbar = forwardRef<HTMLDivElement, CustomContentProps>((props, ref) => {
  const { id, message, variant = "default" } = props;

  // Variant aesthetic tokens matching SEAL Hackathon Platform Design System
  const config = {
    success: {
      icon: CheckCircle2,
      border: "border-emerald-500/30 dark:border-emerald-500/20",
      glow: "shadow-[0_8px_30px_rgba(16,185,129,0.12)] dark:shadow-[0_8px_30px_rgba(16,185,129,0.18)]",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/20",
      accentBar: "bg-emerald-500",
    },
    error: {
      icon: AlertCircle,
      border: "border-rose-500/30 dark:border-rose-500/20",
      glow: "shadow-[0_8px_30px_rgba(244,63,94,0.12)] dark:shadow-[0_8px_30px_rgba(244,63,94,0.18)]",
      iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 dark:bg-rose-500/20",
      accentBar: "bg-rose-500",
    },
    warning: {
      icon: AlertTriangle,
      border: "border-amber-500/30 dark:border-amber-500/20",
      glow: "shadow-[0_8px_30px_rgba(245,158,11,0.12)] dark:shadow-[0_8px_30px_rgba(245,158,11,0.18)]",
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-500/20",
      accentBar: "bg-amber-500",
    },
    info: {
      icon: Info,
      border: "border-sky-500/30 dark:border-sky-500/20",
      glow: "shadow-[0_8px_30px_rgba(14,165,233,0.12)] dark:shadow-[0_8px_30px_rgba(14,165,233,0.18)]",
      iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400 dark:bg-sky-500/20",
      accentBar: "bg-sky-500",
    },
    default: {
      icon: Info,
      border: "border-zinc-300 dark:border-zinc-700/60",
      glow: "shadow-xl shadow-black/10 dark:shadow-black/40",
      iconBg: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
      accentBar: "bg-zinc-500",
    },
  }[variant] || {
    icon: Info,
    border: "border-zinc-300 dark:border-zinc-700/60",
    glow: "shadow-xl shadow-black/10 dark:shadow-black/40",
    iconBg: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    accentBar: "bg-zinc-500",
  };

  const IconComponent = config.icon;

  return (
    <div
      ref={ref}
      onClick={() => closeSnackbar(id)}
      role="button"
      tabIndex={0}
      title="Click to dismiss notification"
      className={`
        group relative pointer-events-auto cursor-pointer select-none
        flex items-center gap-3 px-4 py-3.5 min-w-[280px] max-w-[420px]
        rounded-2xl border ${config.border} ${config.glow}
        bg-white/95 dark:bg-zinc-950/90 backdrop-blur-xl
        text-zinc-900 dark:text-zinc-100
        transition-all duration-200 ease-out
        hover:scale-[1.02] active:scale-[0.98]
        animate-in fade-in slide-in-from-top-4 duration-300
      `}
    >
      {/* Left Accent Indicator */}
      <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${config.accentBar}`} />

      {/* Icon Badge */}
      <div className={`flex items-center justify-center w-8 h-8 rounded-xl shrink-0 ${config.iconBg}`}>
        <IconComponent className="w-4 h-4 stroke-[2.2]" />
      </div>

      {/* Content Message */}
      <div className="flex-1 text-xs sm:text-sm font-medium leading-snug pr-1">
        {message}
      </div>

      {/* Close Action Icon */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          closeSnackbar(id);
        }}
        className="flex items-center justify-center w-6 h-6 rounded-lg text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
});

CustomSnackbar.displayName = "CustomSnackbar";

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  return (
    <NotistackProvider
      maxSnack={4}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      autoHideDuration={4000}
      Components={{
        success: CustomSnackbar,
        error: CustomSnackbar,
        warning: CustomSnackbar,
        info: CustomSnackbar,
        default: CustomSnackbar,
      }}
    >
      {children}
    </NotistackProvider>
  );
}
