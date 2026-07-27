"use client";

import { Button } from "@/components/ui/button";

export default function Banner() {
    const handleBackToHome = () => {
        // Điều hướng bằng JavaScript an toàn cho Next.js Client Component
        if (typeof window !== "undefined") {
            window.location.href = "/";
        }
    };

    return (
        <section className="relative overflow-hidden border-b rounded-none w-full left-0 translate-x-0 md:w-screen md:max-w-[100vw] md:left-1/2 md:-translate-x-1/2 bg-muted/40 border-zinc-200/50 dark:bg-[#120F0E] dark:border-white/[0.03] mb-12 shadow-sm dark:shadow-2xl py-10 sm:py-24 lg:py-28 px-4 sm:px-12 lg:px-20 transition-colors duration-300">

            {/* ĐÃ XÓA: Khối div HIỆU ỨNG LƯỚI Ô CARO ở vị trí này để làm sạch nền */}

            {/* Đốm sáng cam tỏa mịn ở trung tâm nền (Giữ lại để nền không bị phẳng lì, tạo chiều sâu nhẹ) */}
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[35rem] w-[70rem] bg-[#FF6B2C]/5 dark:bg-[#FF6B2C]/10 blur-[160px] animate-seal-pulse rounded-full pointer-events-none transition-colors" />

            {/* BACKGROUND GRAPHICS: Đa giác 2 cánh */}
            {/* Cánh trái: Đa giác Cyan */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[350px] h-[300px] opacity-[0.12] dark:opacity-20 pointer-events-none hidden md:block transition-opacity">
                <svg viewBox="0 0 100 100" className="w-full h-full text-[#06b6d4] stroke-current stroke-[0.3] fill-none">
                    <polygon points="10,50 30,20 70,30 90,60 50,80" />
                    <line x1="10" y1="50" x2="70" y2="30" />
                    <line x1="30" y1="20" x2="50" y2="80" />
                    <line x1="30" y1="20" x2="90" y2="60" />
                </svg>
            </div>

            {/* Cánh phải: Đa giác Cam */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[350px] h-[300px] opacity-[0.12] dark:opacity-15 pointer-events-none hidden md:block transition-opacity">
                <svg viewBox="0 0 100 100" className="w-full h-full text-[#FF6B2C] stroke-current stroke-[0.3] fill-none">
                    <polygon points="90,50 70,80 30,70 10,40 50,20" />
                    <line x1="90" y1="50" x2="30" y2="70" />
                    <line x1="70" y1="80" x2="50" y2="20" />
                    <line x1="70" y1="80" x2="10" y2="40" />
                </svg>
            </div>

            {/* CONTENT CONTAINER */}
            <div className="relative z-10 mx-auto max-w-[1440px] w-full flex flex-col items-start">

                {/* ROW HEADER TRÊN */}
                <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
                    {/* NÚT BACK TO HOME */}
                    <div className="flex items-center">
                        <Button
                            onClick={handleBackToHome}
                            variant="eventBack"
                            size="eventBack"
                            className="gap-2.5 font-black uppercase tracking-widest text-xs md:text-sm text-muted-foreground hover:text-foreground dark:text-[#F4F2F1] transition-colors"
                        >
                            <span className="transform group-hover:-translate-x-0.5 transition-transform duration-150 text-sm leading-none">←</span>
                            <span>Back to home</span>
                        </Button>
                    </div>

                    {/* Cặp Badges bên phải */}
                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#FF6B2C]/20 bg-[#FF6B2C]/5 px-3 py-1 md:px-3.5 md:py-1 text-[10px] md:text-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B2C] animate-pulse" />
                            <span className="text-[#FF6B2C] font-semibold tracking-wide uppercase">S.01 · SEAL Spring 2026</span>
                        </div>
                        <span className="px-3 py-1 md:px-3.5 md:py-1 rounded-full text-[10px] md:text-[11px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 tracking-wider uppercase transition-colors">
                            7 days to deadline
                        </span>
                    </div>
                </div>

                {/* TIÊU ĐỀ KHỔNG LỒ 2 DÒNG */}
                <h1 className="text-3xl sm:text-5xl lg:text-[76px] xl:text-[84px] font-black text-foreground dark:text-white tracking-tighter leading-[1.1] flex flex-col gap-1 md:gap-2 transition-colors">
                    <span>Build the future,</span>
                    <span className="text-[#FF6B2C]">in 48 hours.</span>
                </h1>

                {/* PHẦN TIỂU ĐỀ PHÂN LAYER */}
                <div className="mt-6 md:mt-8 space-y-2 md:space-y-3 max-w-4xl">
                    <p className="text-base sm:text-2xl font-extrabold text-foreground/90 dark:text-[#F4F2F1] leading-snug transition-colors">
                        SEAL Spring is the kickoff season of the 2026 league.
                    </p>
                    <p className="text-xs sm:text-lg text-muted-foreground dark:text-[#A39690] font-bold leading-relaxed transition-colors">
                        Eight tracks, sixty-two mentors, 140Mđ in prizes - and one weekend you&apos;ll never forget.
                    </p>
                </div>

            </div>
        </section>
    );
}