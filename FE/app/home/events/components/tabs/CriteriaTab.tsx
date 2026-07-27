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

    // Cấu trúc mảng Giám khảo & Cố vấn: [Tên viết tắt, Họ và tên, Chức vụ/Vai trò, Đơn vị công tác]
    const mentorsData = [
        ["NHA", "Dr. Nguyen H. Anh", "Head of Software Engineering", "FPT University"],
        ["LTM", "Le T. Minh", "Principal AI Engineer", "Vingroup"],
        ["PVT", "Pham V. Tuan", "Technical Founder", "TechHub Vietnam"],
        ["TQH", "Tran Q. Huong", "VP of Engineering", "Tiki"],
        ["DKL", "Do K. Long", "Staff Engineer", "Grab Vietnam"],
        ["BTM", "Bui T. My", "Senior AI Researcher", "VinAI"],
    ];

    return (
        <div className="space-y-10 animate-fadeIn font-sans">

            {/* 1. Khối tiêu đề chính của Criteria */}
            <section className="bg-[#1A1512] border border-white/[0.04] rounded-[32px] p-8 sm:p-10 shadow-xl relative overflow-hidden">
                <div className="absolute -inset-x-20 -top-20 h-44 bg-[#FF6B2C]/10 blur-[100px] pointer-events-none" />
                <div className="relative">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-[#FF6B2C] font-black">Evaluation</div>
                    <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-black text-foreground tracking-tight">
                        Judging Criteria
                    </h2>
                    <p className="mt-4 text-base text-[#A39690] font-bold leading-relaxed max-w-4xl">
                        The products will be evaluated transparently based on the following four core criteria by a panel of expert judges.
                    </p>
                </div>
            </section>

            {/* 2. Danh sách các tiêu chí đánh giá */}
            <div className="space-y-4">
                {criteriaData.map((item, idx) => (
                    <div key={idx} className="bg-[#1A1512] border border-white/8 rounded-2xl p-6 flex gap-6 items-start hover:border-[#FF6B2C]/30 transition-all duration-200">
                        <div className="h-12 w-12 rounded-xl bg-[#FF6B2C]/10 border-2 border-[#FF6B2C] text-[#FF6B2C] font-mono text-lg font-black flex items-center justify-center shrink-0 shadow-md">
                            0{idx + 1}
                        </div>
                        <div>
                            <h4 className="font-black text-xl text-foreground tracking-wide">{item.title}</h4>
                            <p className="text-sm sm:text-base text-[#A39690] mt-1.5 leading-relaxed font-bold">{item.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* 3. Rounds + Categories (Được cập nhật đồng bộ hoàn chỉnh theo thiết kế mới) */}
            <section className="grid md:grid-cols-2 gap-6">
                {/* Khối Competition Rounds */}
                <div className="bg-[#1A1512] border border-white/8 rounded-[32px] p-8">
                    <h3 className="text-xl font-black text-foreground mb-6 tracking-wide">Competition rounds</h3>
                    <ol className="space-y-4 font-bold text-base">
                        {["Application & Idea Pitch", "48-hour Hackathon", "Track Semifinals", "Grand Final Demo Day"].map((r, i) => (
                            <li key={r} className="flex gap-4 items-center">
                                <span className="font-mono text-lg font-black text-[#FF6B2C] shrink-0">0{i + 1}</span>
                                <span className="text-[#E6E4E2]">{r}</span>
                            </li>
                        ))}
                    </ol>
                </div>

                {/* Khối Categories */}
                <div className="bg-[#1A1512] border border-white/8 rounded-[32px] p-8">
                    <h3 className="text-xl font-black text-foreground mb-6 tracking-wide">Categories</h3>
                    <div className="flex flex-wrap gap-2.5">
                        {["AI · ML", "Web · SaaS", "FinTech", "GreenTech", "Mobile", "Game · XR", "DevTools", "Open"].map(c => (
                            <span
                                key={c}
                                className="px-4 py-2.5 rounded-xl text-xs font-black border border-[#FF6B2C]/20 bg-[#FF6B2C]/5 text-[#FF6B2C] uppercase tracking-wider hover:bg-[#FF6B2C]/10 transition-all duration-150 cursor-default"
                            >
                                {c}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* 4. Rules (Cập nhật đồng bộ viền mảnh không dùng seal-glass) */}
            <section className="bg-[#1A1512] border border-white/8 rounded-[32px] p-8">
                <h2 className="text-2xl font-black text-foreground tracking-tight mb-5">Rules</h2>
                <ul className="space-y-3.5 text-base text-[#A39690] font-bold">
                    {[
                        "Teams of 3–5 students. At least one FPTU student required.",
                        "All code must be written during the 48-hour build window.",
                        "Use of open-source libraries and AI tooling is encouraged.",
                        "Submissions include source code, demo video, and live pitch.",
                        "Judging is blind across track and grand-final rounds.",
                    ].map((r, i) => (
                        <li key={i} className="flex gap-3 items-start">
                            <span className="text-[#FF6B2C] text-lg leading-none">›</span>
                            <span className="text-[#E6E4E2]">{r}</span>
                        </li>
                    ))}
                </ul>
            </section>

            {/* 5. Khối Judges & Mentors với Avatar bo góc vuông rounded-2xl và phân dòng chi tiết */}
            <section className="bg-[#1A1512] border border-white/[0.04] rounded-[32px] p-8 sm:p-10 shadow-xl">
                <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight mb-8 flex items-center gap-3">
                    <span className="h-6 w-1.5 bg-[#FF6B2C] rounded-full" /> Judges & Mentors
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {mentorsData.map(([initials, name, role, company]) => (
                        <div
                            key={name}
                            className="bg-[#120F0E] border border-white/[0.02] rounded-[24px] p-5 flex items-center gap-5 hover:border-[#FF6B2C]/20 transition-all duration-200 shadow-md"
                        >
                            {/* Avatar hình chữ nhật đứng, bo góc lớn rounded-2xl rực màu cam chuẩn mẫu */}
                            <div className="h-14 w-14 rounded-2xl bg-[#E25A20] font-black text-base text-foreground flex items-center justify-center shrink-0 shadow-lg shadow-[#E25A20]/10">
                                {initials}
                            </div>

                            {/* Thông tin chi tiết được căn chỉnh và phân lớp chuẩn xác */}
                            <div className="min-w-0 space-y-1">
                                {/* Tên chính: text-base, font-black, màu trắng sáng */}
                                <div className="font-black text-base text-foreground tracking-wide truncate leading-tight">
                                    {name}
                                </div>
                                {/* Chức vụ: màu cam đặc trưng, viết hoa, font-black dầy dặn */}
                                <div className="text-xs sm:text-sm text-[#FF6B2C] font-black tracking-wide uppercase leading-tight">
                                    {role}
                                </div>
                                {/* Công ty: màu xám mờ tinh tế, font-bold vừa phải tạo tương phản đẹp mắt */}
                                <div className="text-xs text-[#A39690] font-bold truncate leading-tight">
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