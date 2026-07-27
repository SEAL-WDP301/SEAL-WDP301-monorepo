"use client";

export default function SubmitTab() {
    const requirements = [
        {
            step: "01",
            label: "App Listing URL",
            desc: "Link to your published app draft or live production on developer.reddit.com. Ensure the app has been compiled successfully.",
            required: true,
        },
        {
            step: "02",
            label: "Reddit Usernames",
            desc: "List of exact Reddit usernames of all registered team members for verification and award distribution.",
            required: true,
        },
        {
            step: "03",
            label: "Tool Overview",
            desc: "Describe in detail the functionality of the bot/app. Explain how moderators install it, how users interact with it, and its main automation capabilities.",
            required: true,
        },
        {
            step: "04",
            label: "Project Impact Analysis",
            desc: "Identify 1 to 3 communities that would find your app highly useful and explain the measurable time savings or quality of life improvements.",
            required: true,
        },
        {
            step: "05",
            label: "Public GitHub Repository",
            desc: "Provide a link to your public code repository. All core features must be committed and well-documented.",
            required: true,
        },
        {
            step: "06",
            label: "Demo Video Link (2-3 Minutes)",
            desc: "An active Loom, YouTube, or Vimeo link showcasing a live walkthrough and execution of your moderation tool.",
            required: true,
        },
        {
            step: "07",
            label: "[Optional] Developer Platform Feedback",
            desc: "Complete our developer satisfaction survey on Reddit Devvit Platform to compete for the Best Feedback bonus prize.",
            required: false,
        },
    ];

    return (
        <div className="space-y-6 sm:space-y-8 animate-fadeIn font-sans w-full">

            {/* Khối Header của phần Submit */}
            {/* ĐÃ SỬA: Đồng bộ hóa nền bg-card và viền border-border cho responsive theme */}
            <section className="border rounded-[32px] p-5 sm:p-10 relative overflow-hidden shadow-xl bg-card border-border/60 dark:bg-[#1A1512] dark:border-white/[0.04] transition-colors duration-300">
                <div className="absolute -inset-x-20 -top-20 h-44 bg-[#FF6B2C]/10 blur-[100px] pointer-events-none" />
                <div className="relative">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-[#FF6B2C] font-black">Submission guidelines</div>
                    <h2 className="mt-3 text-2xl sm:text-4xl lg:text-5xl font-black text-foreground tracking-tight">
                        How to Submit
                    </h2>
                    <p className="mt-4 text-xs sm:text-base text-muted-foreground dark:text-[#A39690] font-bold leading-relaxed max-w-4xl transition-colors">
                        To be eligible for the prize pool evaluation, please ensure your team submits all the required materials below before the closing deadline.
                    </p>
                </div>
            </section>

            {/* Danh sách các trường dữ liệu cần chuẩn bị nộp */}
            <div className="space-y-4 w-full">
                {requirements.map((req) => (
                    <div
                        key={req.step}
                        /* ĐÃ SỬA: Thay đổi bg-card, border-border, giảm padding nhẹ trên mobile để các card gọn gàng */
                        className="border rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-start gap-4 sm:gap-6 hover:border-[#FF6B2C]/40 bg-card border-border/80 dark:bg-[#1A1512] dark:border-white/8 transition-all duration-200"
                    >
                        {/* Vòng tròn số thứ tự bước */}
                        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-[#E25A20]/10 border-2 border-[#E25A20] font-black text-sm sm:text-base text-[#FF6B2C] flex items-center justify-center shrink-0 shadow-md">
                            {req.step}
                        </div>

                        {/* Chi tiết yêu cầu */}
                        <div className="flex-1 space-y-2 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                <h4 className="font-black text-lg sm:text-xl text-foreground tracking-wide">{req.label}</h4>
                                {req.required ? (
                                    <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[#FF6B2C]/10 text-[#FF6B2C] border border-[#FF6B2C]/20 rounded-md">
                                        Required
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-muted text-muted-foreground border border-border dark:border-white/[0.06] rounded-md transition-colors">
                                        Optional
                                    </span>
                                )}
                            </div>
                            <p className="text-xs sm:text-sm md:text-base text-muted-foreground dark:text-[#A39690] font-bold leading-relaxed transition-colors">
                                {req.desc}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}