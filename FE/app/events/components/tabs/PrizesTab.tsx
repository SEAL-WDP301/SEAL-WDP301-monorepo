"use client";

export default function PrizesTab() {
    return (
        <div className="space-y-6 animate-fadeIn font-sans w-full">

            {/* Total prize pool block */}
            {/* FIXED: Using bg-card and border-border for automatic light/dark adaptation, switching to dark wood background in dark mode */}
            <section className="relative border rounded-[32px] p-6 sm:p-8 overflow-hidden shadow-xl bg-card border-border/60 dark:bg-[#1A1512] dark:border-white/[0.04] transition-colors duration-300">

                {/* Orange ambient glow in the background */}
                <div className="absolute -inset-x-20 -top-20 h-44 bg-[#FF6B2C]/15 blur-[100px] pointer-events-none" />

                <div className="relative">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-[#FF6B2C] font-black">Prize pool</div>

                    {/* Prize amount text using a vibrant gradient effect, sharp on both light and dark backgrounds */}
                    <div className="mt-3 text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight bg-gradient-to-r from-[#FF6B2C] via-[#ff824d] to-[#FFA800] bg-clip-text text-transparent leading-none py-1">
                        140,000,000 VND
                    </div>
                    <p className="mt-3 text-xs sm:text-sm text-muted-foreground dark:text-[#A39690] font-bold transition-colors">
                        + Internship offers · Cloud credits · Conference passes
                    </p>
                </div>
            </section>

            {/* 3-column main prize layout */}
            {/* FIXED: grid-cols-1 default for mobile, automatically expands to grid-cols-3 from sm breakpoint up */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 w-full">

                {/* 1st Place */}
                <div className="border rounded-2xl p-5 flex flex-col justify-between min-h-[110px] hover:border-[#FF6B2C]/40 bg-card border-border/80 dark:bg-[#1A1512] dark:border-white/8 transition-all duration-200">
                    <div>
                        <span className="text-xs text-muted-foreground dark:text-[#A39690] font-black uppercase tracking-wider block transition-colors">1st place</span>

                        <div className="mt-3 flex items-baseline font-black">
                            <span className="text-2xl sm:text-3xl text-[#FF6B2C] tracking-tight leading-none">60,000,000</span>
                            <span className="text-lg sm:text-xl text-[#FF6B2C] font-black ml-1">VND</span>
                        </div>
                    </div>
                </div>

                {/* 2nd Place */}
                <div className="border rounded-2xl p-5 flex flex-col justify-between min-h-[110px] hover:border-[#FF6B2C]/40 bg-card border-border/80 dark:bg-[#1A1512] dark:border-white/8 transition-all duration-200">
                    <div>
                        <span className="text-xs text-muted-foreground dark:text-[#A39690] font-black uppercase tracking-wider block transition-colors">2nd place</span>

                        <div className="mt-3 flex items-baseline font-black">
                            <span className="text-2xl sm:text-3xl text-[#FF6B2C] tracking-tight leading-none">35,000,000</span>
                            <span className="text-lg sm:text-xl text-[#FF6B2C] font-black ml-1">VND</span>
                        </div>
                    </div>
                </div>

                {/* 3rd Place */}
                <div className="border rounded-2xl p-5 flex flex-col justify-between min-h-[110px] hover:border-[#FF6B2C]/40 bg-card border-border/80 dark:bg-[#1A1512] dark:border-white/8 transition-all duration-200">
                    <div>
                        <span className="text-xs text-muted-foreground dark:text-[#A39690] font-black uppercase tracking-wider block transition-colors">3rd place</span>

                        <div className="mt-3 flex items-baseline font-black">
                            <span className="text-2xl sm:text-3xl text-[#FF6B2C] tracking-tight leading-none">20,000,000</span>
                            <span className="text-lg sm:text-xl text-[#FF6B2C] font-black ml-1">VND</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}