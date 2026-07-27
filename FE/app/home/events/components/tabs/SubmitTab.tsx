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
        <div className="space-y-8 animate-fadeIn font-sans">
            {/* Khối Header của phần Submit */}
            <section className="bg-[#1A1512] border border-white/[0.04] rounded-[32px] p-8 sm:p-10 relative overflow-hidden shadow-xl">
                <div className="absolute -inset-x-20 -top-20 h-44 bg-[#FF6B2C]/10 blur-[100px] pointer-events-none" />
                <div className="relative">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-[#FF6B2C] font-black">Submission guidelines</div>
                    <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-black text-foreground tracking-tight">
                        How to Submit
                    </h2>
                    <p className="mt-4 text-base text-[#A39690] font-bold leading-relaxed max-w-4xl">
                        To be eligible for the prize pool evaluation, please ensure your team submits all the required materials below before the closing deadline.
                    </p>
                </div>
            </section>

            {/* Danh sách các trường dữ liệu cần chuẩn bị nộp */}
            <div className="space-y-4">
                {requirements.map((req) => (
                    <div
                        key={req.step}
                        className="bg-[#1A1512] border border-white/8 rounded-2xl p-6 flex flex-col md:flex-row md:items-start gap-6 hover:border-[#FF6B2C]/30 transition-all duration-200"
                    >
                        {/* Vòng tròn số thứ tự bước */}
                        <div className="h-12 w-12 rounded-full bg-[#E25A20]/10 border-2 border-[#E25A20] font-black text-base text-[#FF6B2C] flex items-center justify-center shrink-0 shadow-md">
                            {req.step}
                        </div>

                        {/* Chi tiết yêu cầu */}
                        <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                                <h4 className="font-black text-xl text-foreground tracking-wide">{req.label}</h4>
                                {req.required ? (
                                    <span className="px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-[#FF6B2C]/10 text-[#FF6B2C] border border-[#FF6B2C]/20 rounded-md">
                                        Required
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-muted text-[#A39690] border border-white/[0.06] rounded-md">
                                        Optional
                                    </span>
                                )}
                            </div>
                            <p className="text-sm md:text-base text-[#A39690] font-bold leading-relaxed">
                                {req.desc}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}