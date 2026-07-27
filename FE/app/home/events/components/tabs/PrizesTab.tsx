export default function PrizesTab() {
  return (
    <div className="space-y-6 animate-fadeIn font-sans">
      {/* Khối Tổng giải thưởng lớn (Prize pool) */}
      <section className="relative bg-[#1A1512] border border-white/[0.04] rounded-[32px] p-8 overflow-hidden shadow-xl">

        <div className="absolute -inset-x-20 -top-20 h-44 bg-[#FF6B2C]/15 blur-[100px] pointer-events-none" />

        <div className="relative">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[#FF6B2C] font-black">Prize pool</div>

          <div className="mt-3 text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight bg-gradient-to-r from-[#FF6B2C] via-[#ff824d] to-[#FFA800] bg-clip-text text-transparent leading-none">
            140,000,000đ
          </div>
          <p className="mt-3 text-sm text-[#A39690] font-bold">
            + Internship offers · Cloud credits · Conference passes
          </p>
        </div>
      </section>

      {/* 3 giải thưởng phụ dạng thẻ bo tròn dẹt nằm ngang */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Giải Nhất (1st Place) */}
        <div className="bg-[#1A1512] border border-white/8 rounded-2xl p-5 flex flex-col justify-between min-h-[110px] hover:border-[#FF6B2C]/30 transition-all duration-200">
          <div>
            <span className="text-xs text-[#A39690] font-bold block">1st place</span>

            <div className="mt-2 flex items-baseline font-black">
              <span className="text-2xl sm:text-3xl text-[#FF6B2C] tracking-tight leading-none">60,000,000</span>
              <span className="text-lg sm:text-xl text-[#FF6B2C] font-black ml-1">đ</span>
            </div>
          </div>
        </div>

        {/* Giải Nhì (2nd Place) */}
        <div className="bg-[#1A1512] border border-white/8 rounded-2xl p-5 flex flex-col justify-between min-h-[110px] hover:border-[#FF6B2C]/30 transition-all duration-200">
          <div>
            <span className="text-xs text-[#A39690] font-bold block">2nd place</span>

            <div className="mt-2 flex items-baseline font-black">
              <span className="text-2xl sm:text-3xl text-[#FF6B2C] tracking-tight leading-none">35,000,000</span>
              <span className="text-lg sm:text-xl text-[#FF6B2C] font-black ml-1">đ</span>
            </div>
          </div>
        </div>

        {/* Giải Ba (3rd Place) */}
        <div className="bg-[#1A1512] border border-white/8 rounded-2xl p-5 flex flex-col justify-between min-h-[110px] hover:border-[#FF6B2C]/30 transition-all duration-200">
          <div>
            <span className="text-xs text-[#A39690] font-bold block">3rd place</span>

            <div className="mt-2 flex items-baseline font-black">
              <span className="text-2xl sm:text-3xl text-[#FF6B2C] tracking-tight leading-none">20,000,000</span>
              <span className="text-lg sm:text-xl text-[#FF6B2C] font-black ml-1">đ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}