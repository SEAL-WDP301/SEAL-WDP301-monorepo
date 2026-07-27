"use client";

import { useEffect, useState } from "react";

export default function Countdown() {
    // Giả định mốc thời gian diễn ra sự kiện Hackathon SEAL Spring 2026
    const targetDate = new Date("2026-12-31T00:00:00").getTime();

    // Khởi tạo state bằng một hàm callback để tránh tính toán lại mỗi lần render
    const [timeLeft, setTimeLeft] = useState(() => {
        const now = Date.now();
        const difference = targetDate - now;
        return difference > 0 ? difference : 0;
    });

    useEffect(() => {
        // Nếu thời gian đã hết thì không chạy interval nữa
        if (timeLeft <= 0) return;

        // ĐÃ SỬA: Chạy bộ đếm thời gian thông qua setInterval một cách bất đồng bộ an toàn
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

        // Dọn dẹp bộ nhớ khi component bị unmount
        return () => clearInterval(timer);
    }, [targetDate]);

    // Tính toán ra Ngày, Giờ, Phút, Giây để hiển thị giao diện
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    // Định dạng số hiển thị luôn có 2 chữ số (ví dụ: 09 thay vì 9)
    const formatNumber = (num: number) => String(num).padStart(2, "0");

    return (
        <div className="bg-card dark:bg-[#141210] border border-border/80 dark:border-white/[0.04] rounded-[24px] p-6 text-center transition-colors duration-300">
            <p className="text-xs font-bold uppercase tracking-widest text-[#FF6B2C] mb-4 text-left">
                KICKOFF IN
            </p>

            <div className="grid grid-cols-4 gap-3">
                {/* Khối Ngày */}
                <div className="bg-muted/50 dark:bg-white/[0.02] rounded-[16px] p-3 border border-border/40 dark:border-white/[0.02]">
                    <div className="text-2xl md:text-3xl font-mono font-black text-foreground dark:text-white">
                        {formatNumber(days)}
                    </div>
                    <div className="text-[10px] font-bold text-muted-foreground dark:text-[#A39690] uppercase tracking-wider mt-1">
                        Daze
                    </div>
                </div>

                {/* Khối Giờ */}
                <div className="bg-muted/50 dark:bg-white/[0.02] rounded-[16px] p-3 border border-border/40 dark:border-white/[0.02]">
                    <div className="text-2xl md:text-3xl font-mono font-black text-foreground dark:text-white">
                        {formatNumber(hours)}
                    </div>
                    <div className="text-[10px] font-bold text-muted-foreground dark:text-[#A39690] uppercase tracking-wider mt-1">
                        Hours
                    </div>
                </div>

                {/* Khối Phút */}
                <div className="bg-muted/50 dark:bg-white/[0.02] rounded-[16px] p-3 border border-border/40 dark:border-white/[0.02]">
                    <div className="text-2xl md:text-3xl font-mono font-black text-foreground dark:text-white">
                        {formatNumber(minutes)}
                    </div>
                    <div className="text-[10px] font-bold text-muted-foreground dark:text-[#A39690] uppercase tracking-wider mt-1">
                        Mins
                    </div>
                </div>

                {/* Khối Giây */}
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