"use client";

import React, { useRef, useState, KeyboardEvent, ChangeEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
}

export function OtpInput({ value, onChange, length = 6 }: OtpInputProps) {
  const [showOtp, setShowOtp] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value;
    if (!/^[0-9]*$/.test(val)) return;

    const newValue = value.split("");
    // Just take the last char if they pasted multiple or typed extra
    newValue[index] = val.slice(-1);
    const newOtp = newValue.join("").slice(0, length);
    onChange(newOtp);

    // Auto focus next
    if (val && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const newValue = value.split("");
      
      if (newValue[index]) {
        // If current box has a value, clear it
        newValue[index] = "";
        onChange(newValue.join(""));
      } else if (index > 0) {
        // If current box is empty, go to previous and clear it
        newValue[index - 1] = "";
        onChange(newValue.join(""));
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, length);
    if (pastedData) {
      onChange(pastedData);
      // Focus the next empty input, or the last one
      const nextIndex = Math.min(pastedData.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-2 sm:gap-3">
        {Array.from({ length }).map((_, i) => {
          const char = value[i] || "";
          return (
            <input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type={showOtp ? "text" : "password"}
              inputMode="numeric"
              maxLength={2} // allow typing over
              value={char}
              onChange={(e) => handleChange(e, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onPaste={handlePaste}
              className={cn(
                "h-14 w-12 sm:h-16 sm:w-14 rounded-xl border border-white/15 bg-white/[0.045] text-center text-xl sm:text-2xl font-bold text-foreground outline-none transition-all placeholder:text-[#8f817a]",
                "focus:border-[#ff7629]/70 focus:ring-4 focus:ring-[#ff7629]/15 focus:bg-white/[0.08]",
                char && "border-[#ff7629]/50 shadow-[0_0_15px_rgba(255,112,34,0.15)]"
              )}
            />
          );
        })}
      </div>
      
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => setShowOtp(!showOtp)}
          variant="subtleIcon"
          size="auto"
          className="p-0 text-xs font-medium"
        >
          {showOtp ? (
            <>
              <EyeOff className="size-4" />
              Ẩn mã OTP
            </>
          ) : (
            <>
              <Eye className="size-4" />
              Hiện mã OTP
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
