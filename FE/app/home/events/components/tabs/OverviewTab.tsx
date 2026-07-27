// Thành phần hiển thị mốc thời gian (TimelineItem) được tích hợp trực tiếp để tránh lỗi import
function TimelineItem({ date, title, desc }: { date: string; title: string; desc: string }) {
    return (
        <div className="bg-[#120F0E] border border-white/[0.02] rounded-[24px] p-6 flex flex-col sm:flex-row sm:items-center gap-6 transition-all hover:border-[#FF6B2C]/20">
            <div className="font-mono text-sm font-black text-[#FF6B2C] sm:w-52 shrink-0">{date}</div>
            <div className="flex-1">
                <div className="font-black text-xl text-foreground">{title}</div>
                <div className="text-sm font-bold text-[#A39690] mt-1">{desc}</div>
            </div>
        </div>
    );
}

export default function OverviewTab() {
    const timelineData = [
        ["Mar 01 → Mar 30", "Registration Window", "Form your team, brainstorm your idea, and submit your initial application details."],
        ["Apr 01", "Opening Ceremony & Matchmaking", "Keynote session with Reddit Devvit engineers plus live team matchmaking."],
        ["Apr 02 → Apr 04", "48-Hour Hackathon", "Build, break, ship — non-stop intense building phase with 24/7 mentor support."],
        ["Apr 08", "Semifinals Pitch", "Top 24 outstanding teams pitch their projects live to track technical judges."],
        ["Apr 12", "Demo Day & Awards Grand Finale", "Grand finale presentations and live prize distribution at FPTU Auditorium."],
    ];

    const faqs = [
        {
            q: "Who can participate in this hackathon?",
            a: "All high school and university students nationwide (FPTU students are highly encouraged). You can participate in teams of 3-5 members or register solo to be matched with other members by the organizers.",
        },
        {
            q: "What is Reddit Devvit and why is it mandatory?",
            a: "Devvit is the official Reddit Developer Platform. This competition focuses on creating moderation tools and community utilities built directly on the Devvit ecosystem to solve real moderator pain points.",
        },
        {
            q: "Am I allowed to use external libraries or AI tools?",
            a: "Absolutely! You are free to use open-source libraries, external APIs, and AI assistants (GitHub Copilot, ChatGPT, etc.) to accelerate your development, provided that the core codebase is built within the 48-hour window.",
        },
        {
            q: "What are the requirements for the final submission?",
            a: "A working application built on Devvit, open-source code on GitHub with documentation, and a 2-3 minute demo video showcasing your app's live features.",
        },
    ];

    const resources = [
        { title: "Devvit Quickstart Guide", link: "https://developers.reddit.com", desc: "Guide to setting up your environment and running your first Devvit app in just 5 minutes." },
        { title: "Reddit Data API Reference", link: "https://www.reddit.com/dev/api", desc: "Official reference documentation for Reddit APIs, events, and developer data streams." },
        { title: "SEAL Discord Community", link: "#", desc: "24/7 technical support channel directly from tech experts and Reddit engineers." },
    ];

    return (
        <div className="space-y-10 animate-fadeIn font-sans">

            {/* 1. About This Hackathon */}
            <section className="bg-[#1A1512] border border-white/[0.04] rounded-[32px] p-8 sm:p-10 shadow-xl">
                <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight mb-5 flex items-center gap-3">
                    <span className="h-6 w-1.5 bg-[#FF6B2C] rounded-full" /> About This Hackathon
                </h2>
                <p className="text-[#A39690] text-base sm:text-lg lg:text-xl leading-relaxed font-bold">
                    SEAL Spring 2026 brings an explosive technology playground for over 250 young developer teams to design and deploy practical applications within 48 hours. Supported by Reddit engineers and top mentors from VinAI, Vingroup, Tiki, and Grab, you will have direct access to global-scale community moderation challenges.
                </p>

                <div className="mt-8 pt-8 border-t border-white/[0.04] grid grid-cols-1 sm:grid-cols-2 gap-6 text-base">
                    <div className="bg-[#120F0E] p-5 rounded-2xl border border-white/[0.02]">
                        <span className="text-xs text-[#FF6B2C] font-black uppercase tracking-wider block mb-1">Target Participants</span>
                        <span className="text-foreground font-extrabold text-base sm:text-lg leading-snug block">Students & tech enthusiasts, open registration</span>
                    </div>
                    <div className="bg-[#120F0E] p-5 rounded-2xl border border-white/[0.02]">
                        <span className="text-xs text-[#FF6B2C] font-black uppercase tracking-wider block mb-1">Platform Requirement</span>
                        <span className="text-foreground font-extrabold text-base sm:text-lg leading-snug block">Must be built on the Reddit Developer Platform (Devvit)</span>
                    </div>
                </div>
            </section>

            {/* 2. What to Build */}
            <section className="bg-[#1A1512] border border-white/[0.04] rounded-[32px] p-8 sm:p-10 shadow-xl">
                <h3 className="text-3xl font-black text-foreground tracking-tight mb-4">What to Build</h3>
                <p className="text-[#A39690] text-base sm:text-lg font-bold leading-relaxed mb-6">
                    Build automation tools or community interaction utilities that ease the workload for moderators, optimize the Reddit user experience, curb toxic content, or create engaging interactive mini-games.
                </p>
                <div className="bg-[#120F0E] border border-white/[0.02] rounded-2xl p-6 text-base text-[#A39690] space-y-4 font-bold leading-relaxed shadow-inner">
                    <p className="flex gap-3"><span className="text-[#FF6B2C] shrink-0">💡</span> <span>Your app can run entirely in the background (background automation) or feature a highly flexible, custom interactive user interface (custom post component).</span></p>
                    <p className="flex gap-3"><span className="text-[#FF6B2C] shrink-0">💡</span> <span>The key to winning lies in high practicality: How much time does it save for moderators, and what community pain points does it solve most seamlessly.</span></p>
                </div>
            </section>

            {/* 3. Resources & Dev Tools */}
            <section className="bg-[#1A1512] border border-white/[0.04] rounded-[32px] p-8 sm:p-10 shadow-xl">
                <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight mb-6">Resources & Developer Kit</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                    {resources.map((res) => (
                        <div key={res.title} className="bg-[#120F0E] border border-white/[0.02] rounded-2xl p-5 hover:border-[#FF6B2C]/30 transition-all">
                            <span className="text-sm font-black text-[#FF6B2C] block uppercase tracking-wider">Resource</span>
                            <a href={res.link} target="_blank" rel="noreferrer" className="text-lg font-black text-foreground mt-2 block hover:underline">
                                {res.title}
                            </a>
                            <p className="text-xs text-[#A39690] mt-2 font-bold leading-relaxed">{res.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* 4. Timeline */}
            <section className="bg-[#1A1512] border border-white/[0.04] rounded-[32px] p-8 sm:p-10 shadow-xl">
                <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight mb-6">Timeline & Schedule</h2>
                <div className="space-y-4">
                    {timelineData.map(([date, title, desc], i) => (
                        <TimelineItem key={i} date={date} title={title} desc={desc} />
                    ))}
                </div>
            </section>

            {/* 5. Frequently Asked Questions */}
            <section className="bg-[#1A1512] border border-white/[0.04] rounded-[32px] p-8 sm:p-10 shadow-xl">
                <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight mb-6">Frequently Asked Questions</h2>
                <div className="space-y-5">
                    {faqs.map((faq, i) => (
                        <div key={i} className="bg-[#120F0E] border border-white/[0.02] p-6 rounded-2xl">
                            <h4 className="font-black text-lg text-foreground flex gap-2">
                                <span className="text-[#FF6B2C]">Q:</span> {faq.q}
                            </h4>
                            <p className="mt-2.5 text-sm sm:text-base text-[#A39690] font-bold leading-relaxed pl-6 border-l border-[#FF6B2C]/20">
                                {faq.a}
                            </p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}