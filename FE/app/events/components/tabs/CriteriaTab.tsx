"use client";

export default function CriteriaTab() {
    const criteriaData = [
        {
            title: "Community Impact",
            desc: "How effectively does this tool solve real issues for subreddit moderators? Does it save measurable time or resources for the communities?"
        },
        {
            title: "Technical Execution",
            desc: "Is the app stable, clean, and optimized? Does it leverage Devvit platform capabilities to its fullest potential smoothly?"
        },
        {
            title: "User Experience",
            desc: "Is the tool easy to understand and quick to install for non-technical moderators? Features a clean and intuitive flow."
        },
        {
            title: "Originality & Innovation",
            desc: "Does this submission provide a fresh perspective or unique approach to community management automation?"
        }
    ];

    const mentorsData = [
        ["NHA", "Dr. Nguyen H. Anh", "Head of Software Engineering", "FPT University"],
        ["LTM", "Le T. Minh", "Principal AI Engineer", "Vingroup"],
        ["PVT", "Pham V. Tuan", "Technical Founder", "TechHub Vietnam"],
        ["TQH", "Tran Q. Huong", "VP of Engineering", "Tiki"],
        ["DKL", "Do K. Long", "Staff Engineer", "Grab Vietnam"],
        ["BTM", "Bui T. My", "Senior AI Researcher", "VinAI"],
    ];

    return (
        <div className="space-y-10 animate-fadeIn font-sans w-full">

            {/* 1. Khối tiêu đề chính của Criteria */}
            {/* ĐÃ SỬA: Chuyển sang dùng bg-card/ border-border, tự động thích ứng light/dark */}
            <section className="border rounded-[32px] p-6 sm:p-10 shadow-xl relative overflow-hidden bg-card border-border/60 dark:bg-[#1A1512] dark:border-white/[0.04] transition-colors duration-300">
                <div className="absolute -inset-x-20 -top-20 h-44 bg-[#FF6B2C]/10 blur-[100px] pointer-events-none" />
                <div className="relative">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-[#FF6B2C] font-black">Evaluation</div>
                    <h2 className="mt-3 text-2xl sm:text-4xl lg:text-5xl font-black text-foreground tracking-tight">
                        Judging Criteria
                    </h2>
                    <p className="mt-4 text-sm sm:text-base text-muted-foreground dark:text-[#A39690] font-bold leading-relaxed max-w-4xl transition-colors">
                        The products will be evaluated transparently based on the following four core criteria by a panel of expert judges.
                    </p>
                </div>
            </section>

            {/* 2. Danh sách các tiêu chí đánh giá */}
            <div className="space-y-4 w-full">
                {criteriaData.map((item, idx) => (
                    /* ĐÃ SỬA: Tối ưu màu nền hộp tiêu chí tương phản nhạy bén */
                    <div
                        key={idx}
                        className="border rounded-2xl p-5 sm:p-6 flex gap-4 sm:gap-6 items-start hover:border-[#FF6B2C]/40 bg-card border-border/80 dark:bg-[#1A1512] dark:border-white/8 transition-all duration-200"
                    >
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-[#FF6B2C]/10 border-2 border-[#FF6B2C] text-[#FF6B2C] font-mono text-base sm:text-lg font-black flex items-center justify-center shrink-0 shadow-md">
                            0{idx + 1}
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-black text-lg sm:text-xl text-foreground tracking-wide">{item.title}</h4>
                            <p className="text-xs sm:text-sm text-muted-foreground dark:text-[#A39690] mt-1.5 leading-relaxed font-bold transition-colors">{item.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* 3. Rounds + Categories */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {/* Khối Competition Rounds */}
                <div className="border rounded-[32px] p-6 sm:p-8 bg-card border-border/80 dark:bg-[#1A1512] dark:border-white/8 transition-colors duration-300">
                    <h3 className="text-lg sm:text-xl font-black text-foreground mb-6 tracking-wide">Competition rounds</h3>
                    <ol className="space-y-4 font-bold text-sm sm:text-base">
                        {["Application & Idea Pitch", "48-hour Hackathon", "Track Semifinals", "Grand Final Demo Day"].map((r, i) => (
                            <li key={r} className="flex gap-4 items-center">
                                <span className="font-mono text-base sm:text-lg font-black text-[#FF6B2C] shrink-0">0{i + 1}</span>
                                <span className="text-foreground/90 dark:text-[#E6E4E2] transition-colors">{r}</span>
                            </li>
                        ))}
                    </ol>
                </div>

                {/* Khối Categories */}
                <div className="border rounded-[32px] p-6 sm:p-8 bg-card border-border/80 dark:bg-[#1A1512] dark:border-white/8 transition-colors duration-300">
                    <h3 className="text-lg sm:text-xl font-black text-foreground mb-6 tracking-wide">Categories</h3>
                    <div className="flex flex-wrap gap-2">
                        {["AI · ML", "Web · SaaS", "FinTech", "GreenTech", "Mobile", "Game · XR", "DevTools", "Open"].map(c => (
                            <span
                                key={c}
                                className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-black border border-[#FF6B2C]/20 bg-[#FF6B2C]/5 text-[#FF6B2C] uppercase tracking-wider hover:bg-[#FF6B2C]/10 transition-all duration-150 cursor-default"
                            >
                                {c}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* 4. Rules */}
            <section className="border rounded-[32px] p-6 sm:p-8 bg-card border-border/80 dark:bg-[#1A1512] dark:border-white/8 transition-colors duration-300">
                <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mb-5">Rules</h2>
                <ul className="space-y-3.5 text-sm sm:text-base font-bold">
                    {[
                        "Teams of 3–5 students. At least one FPTU student required.",
                        "All code must be written during the 48-hour build window.",
                        "Use of open-source libraries and AI tooling is encouraged.",
                        "Submissions include source code, demo video, and live pitch.",
                        "Judging is blind across track and grand-final rounds.",
                    ].map((r, i) => (
                        <li key={i} className="flex gap-3 items-start">
                            <span className="text-[#FF6B2C] text-lg leading-none">›</span>
                            <span className="text-foreground/90 dark:text-[#E6E4E2] transition-colors">{r}</span>
                        </li>
                    ))}
                </ul>
            </section>

            {/* 5. Khối Judges & Mentors */}
            <section className="border rounded-[32px] p-6 sm:p-10 shadow-xl bg-card border-border/60 dark:bg-[#1A1512] dark:border-white/[0.04] transition-colors duration-300">
                <h2 className="text-2xl sm:text-4xl font-black text-foreground tracking-tight mb-8 flex items-center gap-3">
                    <span className="h-6 w-1.5 bg-[#FF6B2C] rounded-full" /> Judges & Mentors
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {mentorsData.map(([initials, name, role, company]) => (
                        <div
                            key={name}
                            /* ĐÃ SỬA: Đổi màu hộp mentor từ bg-[#120F0E] sang lớp nền tương phản dịu mắt ở Light Mode */
                            className="border rounded-[24px] p-4 sm:p-5 flex items-center gap-4 sm:gap-5 hover:border-[#FF6B2C]/30 transition-all duration-200 shadow-sm bg-background border-border/50 dark:bg-[#120F0E] dark:border-white/[0.02]"
                        >
                            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-[#E25A20] font-black text-sm sm:text-base text-white flex items-center justify-center shrink-0 shadow-lg shadow-[#E25A20]/10">
                                {initials}
                            </div>

                            <div className="min-w-0 space-y-0.5 sm:space-y-1 flex-1">
                                <div className="font-black text-sm sm:text-base text-foreground tracking-wide truncate leading-tight">
                                    {name}
                                </div>
                                <div className="text-[11px] sm:text-xs text-[#FF6B2C] font-black tracking-wide uppercase truncate leading-tight">
                                    {role}
                                </div>
                                <div className="text-[11px] sm:text-xs text-muted-foreground dark:text-[#A39690] font-bold truncate leading-tight transition-colors">
                                    {company}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

        </div>
    );
}