"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import Countdown from "./Countdown";

export default function Sidebar() {
    return (
        <>
            <aside className="lg:sticky lg:top-24 self-start space-y-6 pb-24 lg:pb-0 w-full">
                <Countdown />

                <div className="border rounded-[24px] p-6 space-y-4 text-sm font-medium bg-card border-border/80 dark:bg-[#141210] dark:border-white/[0.04] transition-colors duration-300">

                    <div className="flex justify-between items-center pb-3 border-b border-border/60 dark:border-white/[0.04] transition-colors">
                        <span className="text-muted-foreground dark:text-[#A39690] transition-colors">Status</span>
                        <span className="text-[#FF6B2C] font-bold flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B2C] animate-ping" /> Registration Open
                        </span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-border/60 dark:border-white/[0.04] transition-colors">
                        <span className="text-muted-foreground dark:text-[#A39690] transition-colors">Format</span>
                        <span className="text-foreground dark:text-white font-semibold text-right max-w-[60%] lg:max-w-none transition-colors">
                            Hybrid (Online + FPTU HCMC)
                        </span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-border/60 dark:border-white/[0.04] transition-colors">
                        <span className="text-muted-foreground dark:text-[#A39690] transition-colors">Registered Teams</span>
                        <span className="text-foreground dark:text-white font-mono font-bold transition-colors">2,644 participants</span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-border/60 dark:border-white/[0.04] transition-colors">
                        <span className="text-muted-foreground dark:text-[#A39690] transition-colors">Hackathon Judges</span>
                        <span className="text-foreground dark:text-white font-semibold text-right transition-colors">Reddit Official Panel</span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground dark:text-[#A39690] transition-colors">Language</span>
                        <span className="text-foreground dark:text-white font-semibold transition-colors">English / Vietnamese</span>
                    </div>

                </div>

                {/* Cặp nút CTA tĩnh: Chỉ xuất hiện trên màn hình máy tính (lg trở lên), ẩn hoàn toàn trên mobile */}
                <div className="hidden lg:block space-y-3">
                    <Button
                        asChild
                        variant="eventCta"
                        size="eventCta"
                        className="w-full font-bold shadow-[0_4px_12px_rgba(243,112,33,0.15)]"
                    >
                        <Link href="/register">
                            Join hackathon →
                        </Link>
                    </Button>
                    <Button variant="eventOutline" size="eventCta" className="w-full font-semibold border-border dark:border-white/[0.06]">
                        Join Discord & r/Devvit Support
                    </Button>
                </div>
            </aside>

            {/* 2. STICKY BOTTOM BAR CHO MOBILE: Cố định 2 nút hành động ở đáy màn hình điện thoại */}
            {/* ĐÃ SỬA: Đồng bộ hóa nền bg-background/95 kết hợp border-border để thanh dock chân thực, thanh thoát trên cả nền sáng */}
            <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-md border-t border-border dark:bg-[#141210]/95 dark:border-white/[0.06] p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_-10px_30px_rgba(0,0,0,0.5)] flex gap-3 transition-colors duration-300">
                <Button variant="eventOutline" size="sm" className="flex-1 font-semibold text-xs h-12 py-0 border-border dark:border-white/[0.06]">
                    Discord Support
                </Button>

                <Button
                    asChild
                    variant="eventCta"
                    size="sm"
                    className="flex-1 font-bold text-xs h-12 shadow-[0_4px_12px_rgba(243,112,33,0.1)]"
                >
                    <Link href="/register" className="flex items-center justify-center">
                        Join hackathon →
                    </Link>
                </Button>
            </div>
        </>
    );
}