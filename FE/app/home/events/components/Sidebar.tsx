import Link from "next/link";
import { Button } from "@/components/ui/button";
import Countdown from "./Countdown";

export default function Sidebar() {
    return (
        <>
            {/* 1. SIDEBAR CHÍNH: Hiển thị tự nhiên trên Desktop, tạo khoảng cách đệm trên Mobile */}
            <aside className="lg:sticky lg:top-8 self-start space-y-6 pb-24 lg:pb-0">
                {/* Live Countdown Component */}
                <Countdown />

                {/* Khối thông số chi tiết */}
                <div className="bg-[#141210] border border-white/[0.04] rounded-[24px] p-6 space-y-4 text-sm font-medium">
                    <div className="flex justify-between items-center pb-3 border-b border-white/[0.04]">
                        <span className="text-[#A39690]">Status</span>
                        <span className="text-[#FF6B2C] font-bold flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B2C] animate-ping" /> Registration Open
                        </span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-white/[0.04]">
                        <span className="text-[#A39690]">Format</span>
                        {/* Tối ưu chữ dài trên mobile: Thêm text-right để tránh vỡ dòng lộn xộn */}
                        <span className="text-white font-semibold text-right max-w-[60%] lg:max-w-none">
                            Hybrid (Online + FPTU HCMC)
                        </span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-white/[0.04]">
                        <span className="text-[#A39690]">Registered Teams</span>
                        <span className="text-white font-mono font-bold">2,644 participants</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-white/[0.04]">
                        <span className="text-[#A39690]">Hackathon Judges</span>
                        <span className="text-white font-semibold text-right">Reddit Official Panel</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[#A39690]">Language</span>
                        <span className="text-white font-semibold">English / Vietnamese</span>
                    </div>
                </div>

                {/* Cặp nút CTA tĩnh: Chỉ xuất hiện trên màn hình máy tính (lg trở lên), ẩn hoàn toàn trên mobile */}
                <div className="hidden lg:block space-y-3">
                    <Button
                        asChild
                        variant="eventCta"
                        size="eventCta"
                        className="w-full font-bold"
                    >
                        <Link href="/register">
                            Join hackathon →
                        </Link>
                    </Button>
                    <Button variant="eventOutline" size="eventCta" className="w-full font-semibold">
                        Join Discord & r/Devvit Support
                    </Button>
                </div>
            </aside>

            {/* 2. STICKY BOTTOM BAR CHO MOBILE: Cố định 2 nút hành động ở đáy màn hình điện thoại */}
            {/* class "lg:hidden" bảo đảm khối này biến mất hoàn toàn trên máy tính */}
            <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-[#141210]/95 backdrop-blur-md border-t border-white/[0.06] p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] flex gap-3">
                <Button variant="eventOutline" size="sm" className="flex-1 font-semibold text-xs h-12 py-0">
                    Discord Support
                </Button>

                <Button
                    asChild
                    variant="eventCta"
                    size="sm"
                    className="flex-1 font-bold text-xs h-12"
                >
                    <Link href="/register" className="flex items-center justify-center">
                        Join hackathon →
                    </Link>
                </Button>
            </div>
        </>
    );
}