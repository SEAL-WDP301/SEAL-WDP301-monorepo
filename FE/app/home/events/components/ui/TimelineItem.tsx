interface TimelineItemProps {
    date: string;
    title: string;
    desc: string;
}

export default function TimelineItem({ date, title, desc }: TimelineItemProps) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 p-6 rounded-3xl bg-[#221A15] border border-white/[0.03] hover:border-[#FF6B2C]/40 transition-all group">
            {/* Ngày tháng bên trái - màu cam nổi bật */}
            <div className="font-sans text-base text-[#FF6B2C] sm:w-44 shrink-0 font-extrabold tracking-wide">
                {date}
            </div>

            {/* Nội dung bên phải */}
            <div className="space-y-1">
                <div className="font-bold text-foreground text-lg group-hover:text-[#FF6B2C] transition-colors">
                    {title}
                </div>
                <div className="text-sm text-[#A39690] leading-relaxed font-medium">
                    {desc}
                </div>
            </div>
        </div>
    );
}