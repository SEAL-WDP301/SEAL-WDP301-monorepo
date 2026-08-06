"use client";

import { useEffect, useState } from "react";

export default function Countdown() {
    // Assumed event date for SEAL Spring 2026 Hackathon
    const targetDate = new Date("2026-12-31T00:00:00").getTime();

    // Initialize state with a callback function to avoid recomputation on every render
    const [timeLeft, setTimeLeft] = useState(() => {
        const now = Date.now();
        const difference = targetDate - now;
        return difference > 0 ? difference : 0;
    });

    useEffect(() => {
        // If time has run out, stop the interval
        if (timeLeft <= 0) return;

        // FIXED: Running the countdown timer via setInterval in a safe async manner
        const timer = setInterval(() => {
            const now = Date.now();
            const difference = targetDate - now;

            if (difference <= 0) {
                setTimeLeft(0);
                clearInterval(timer);
            } else {
                setTimeLeft(difference);
            }
        }, 1000);

        // Cleanup when the component is unmounted
        return () => clearInterval(timer);
    }, [targetDate]);

    // Compute Days, Hours, Minutes, Seconds for display
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    // Format numbers to always display 2 digits (e.g. 09 instead of 9)
    const formatNumber = (num: number) => String(num).padStart(2, "0");

    return (
        <div className="bg-card dark:bg-[#141210] border border-border/80 dark:border-white/[0.04] rounded-[24px] p-6 text-center transition-colors duration-300">
            <p className="text-xs font-bold uppercase tracking-widest text-[#FF6B2C] mb-4 text-left">
                KICKOFF IN
            </p>

            <div className="grid grid-cols-4 gap-3">
                {/* Days block */}
                <div className="bg-muted/50 dark:bg-white/[0.02] rounded-[16px] p-3 border border-border/40 dark:border-white/[0.02]">
                    <div className="text-2xl md:text-3xl font-mono font-black text-foreground dark:text-white">
                        {formatNumber(days)}
                    </div>
                    <div className="text-[10px] font-bold text-muted-foreground dark:text-[#A39690] uppercase tracking-wider mt-1">
                        Days
                    </div>
                </div>

                {/* Hours block */}
                <div className="bg-muted/50 dark:bg-white/[0.02] rounded-[16px] p-3 border border-border/40 dark:border-white/[0.02]">
                    <div className="text-2xl md:text-3xl font-mono font-black text-foreground dark:text-white">
                        {formatNumber(hours)}
                    </div>
                    <div className="text-[10px] font-bold text-muted-foreground dark:text-[#A39690] uppercase tracking-wider mt-1">
                        Hours
                    </div>
                </div>

                {/* Minutes block */}
                <div className="bg-muted/50 dark:bg-white/[0.02] rounded-[16px] p-3 border border-border/40 dark:border-white/[0.02]">
                    <div className="text-2xl md:text-3xl font-mono font-black text-foreground dark:text-white">
                        {formatNumber(minutes)}
                    </div>
                    <div className="text-[10px] font-bold text-muted-foreground dark:text-[#A39690] uppercase tracking-wider mt-1">
                        Mins
                    </div>
                </div>

                {/* Seconds block */}
                <div className="bg-muted/50 dark:bg-white/[0.02] rounded-[16px] p-3 border border-border/40 dark:border-white/[0.02]">
                    <div className="text-2xl md:text-3xl font-mono font-black text-[#FF6B2C] animate-pulse">
                        {formatNumber(seconds)}
                    </div>
                    <div className="text-[10px] font-bold text-muted-foreground dark:text-[#A39690] uppercase tracking-wider mt-1">
                        Sec
                    </div>
                </div>
            </div>
        </div>
    );
}