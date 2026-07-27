"use client";

import { useEffect, useMemo, useState } from "react";

export default function Countdown() {
    // 1. Khắc phục lỗi Hydration: Đặt mốc thời gian cố định dựa trên thời gian thực tế
    const targetDate = useMemo(() => {
        const date = new Date("2026-06-05T00:00:00+07:00"); // Đặt hẳn một ngày cố định cụ thể
        return date.getTime();
    }, []);

    // Không chạy Date.now() ngay khi khởi tạo để tránh lệch dữ liệu Server-Client
    const [now, setNow] = useState<number | null>(null);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNow(Date.now()); // Chỉ gán thời gian sau khi component đã mount lên trình duyệt
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Nếu chưa mount xong, hiện trạng thái loading nhẹ hoặc giữ layout cố định
    if (now === null) {
        return (
            <div className="relative bg-[#1D1714]/50 border border-white/[0.04] rounded-[28px] p-6 shadow-xl h-[120px] animate-pulse" />
        );
    }

    const ms = Math.max(0, targetDate - now);
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms / 3600000) % 24);
    const m = Math.floor((ms / 60000) % 60); // Thêm Phút để bộ đếm mượt mà
    const s = Math.floor((ms / 1000) % 60);

    // Chuyển thành lưới 4 cột (DAZE, HOURS, MINS, SEC) giúp người dùng trải nghiệm tốt hơn
    const timeUnits = [
        { label: "DAZE", val: d },
        { label: "HOURS", val: h },
        { label: "MINS", val: m },
        { label: "SEC", val: s }
    ];

    return (
        <div className="relative bg-[#1D1714]/50 border border-white/[0.04] rounded-[28px] p-4 md:p-6 shadow-xl overflow-hidden w-full">
            {/* Vệt cam mờ nhẹ góc trái */}
            <div className="absolute -inset-x-10 -top-10 h-28 bg-[#FF6B2C]/5 blur-[60px] pointer-events-none" />

            <div className="relative">
                <div className="text-xs uppercase tracking-[0.2em] text-[#FF6B2C] font-black text-center md:text-left">
                    KICKOFF IN
                </div>

                {/* Tinh chỉnh Grid thành 4 cột, thu nhỏ khoảng cách gap trên mobile để không bị tràn dòng */}
                <div className="mt-4 grid grid-cols-4 gap-2 md:gap-3">
                    {timeUnits.map((item) => (
                        <div
                            key={item.label}
                            className="text-center rounded-2xl bg-[#120F0E]/80 border border-white/[0.02] py-3 md:py-4 px-1 md:px-2"
                        >
                            {/* text-2xl trên điện thoại nhỏ, tự phóng to lên text-3xl trên máy tính */}
                            <div className="text-2xl md:text-3xl font-black text-[#FF6B2C] tracking-tight font-mono">
                                {String(item.val).padStart(2, "0")}
                            </div>
                            {/* Chữ nhãn siêu nhỏ [8px] trên mobile để không bị vỡ bố cục gãy dòng */}
                            <div className="text-[8px] md:text-[10px] font-black tracking-wider text-[#A39690] mt-1">
                                {item.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}