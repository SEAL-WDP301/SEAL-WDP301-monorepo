"use client";

export default function PrizesTab() {
    return (
        <div className="space-y-6 animate-fadeIn font-sans w-full">

            {/* Khối Tổng giải thưởng lớn (Prize pool) */}
            {/* ĐÃ SỬA: Sử dụng bg-card và border-border để thích ứng light/dark tự động, chuyển nền đen gỗ khi vào dark mode */}
            <section className="relative border rounded-[32px] p-6 sm:p-8 overflow-hidden shadow-xl bg-card border-border/60 dark:bg-[#1A1512] dark:border-white/[0.04] transition-colors duration-300">

                {/* Đốm sáng màu cam lan tỏa phía sau */}
                <div className="absolute -inset-x-20 -top-20 h-44 bg-[#FF6B2C]/15 blur-[100px] pointer-events-none" />

                <div className="relative">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-[#FF6B2C] font-black">Prize pool</div>

                    {/* Dòng chữ số tiền sử dụng hiệu ứng Gradient rực rỡ, hiển thị sắc nét trên cả nền trắng lẫn nền đen */}
                    <div className="mt-3 text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight bg-gradient-to-r from-[#FF6B2C] via-[#ff824d] to-[#FFA800] bg-clip-text text-transparent leading-none py-1">
                        140,000,000đ
                    </div>
                    <p className="mt-3 text-xs sm:text-sm text-muted-foreground dark:text-[#A39690] font-bold transition-colors">
                        + Internship offers · Cloud credits · Conference passes
                    </p>
                </div>
            </section>

            {/* Hệ thống 3 cột giải thưởng chính */}
            {/* ĐÃ SỬA: grid-cols-1 mặc định cho mobile, tự động dàn thành hàng ngang grid-cols-3 từ màn hình sm trở lên */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 w-full">

                {/* Giải Nhất (1st Place) */}
                <div className="border rounded-2xl p-5 flex flex-col justify-between min-h-[110px] hover:border-[#FF6B2C]/40 bg-card border-border/80 dark:bg-[#1A1512] dark:border-white/8 transition-all duration-200">
                    <div>
                        <span className="text-xs text-muted-foreground dark:text-[#A39690] font-black uppercase tracking-wider block transition-colors">1st place</span>

                        <div className="mt-3 flex items-baseline font-black">
                            <span className="text-2xl sm:text-3xl text-[#FF6B2C] tracking-tight leading-none">60,000,000</span>
                            <span className="text-lg sm:text-xl text-[#FF6B2C] font-black ml-1">đ</span>
                        </div>
                    </div>
                </div>

                {/* Giải Nhì (2nd Place) */}
                <div className="border rounded-2xl p-5 flex flex-col justify-between min-h-[110px] hover:border-[#FF6B2C]/40 bg-card border-border/80 dark:bg-[#1A1512] dark:border-white/8 transition-all duration-200">
                    <div>
                        <span className="text-xs text-muted-foreground dark:text-[#A39690] font-black uppercase tracking-wider block transition-colors">2nd place</span>

                        <div className="mt-3 flex items-baseline font-black">
                            <span className="text-2xl sm:text-3xl text-[#FF6B2C] tracking-tight leading-none">35,000,000</span>
                            <span className="text-lg sm:text-xl text-[#FF6B2C] font-black ml-1">đ</span>
                        </div>
                    </div>
                </div>

                {/* Giải Ba (3rd Place) */}
                <div className="border rounded-2xl p-5 flex flex-col justify-between min-h-[110px] hover:border-[#FF6B2C]/40 bg-card border-border/80 dark:bg-[#1A1512] dark:border-white/8 transition-all duration-200">
                    <div>
                        <span className="text-xs text-muted-foreground dark:text-[#A39690] font-black uppercase tracking-wider block transition-colors">3rd place</span>

                        <div className="mt-3 flex items-baseline font-black">
                            <span className="text-2xl sm:text-3xl text-[#FF6B2C] tracking-tight leading-none">20,000,000</span>
                            <span className="text-lg sm:text-xl text-[#FF6B2C] font-black ml-1">đ</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}