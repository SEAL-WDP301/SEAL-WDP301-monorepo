interface MentorCardProps {
    initials: string;
    name: string;
    role: string;
}

export default function MentorCard({ initials, name, role }: MentorCardProps) {
    return (
        <div className="bg-[#221A15] border border-white/[0.02] rounded-3xl p-6 flex items-center gap-5 hover:border-[#FF6B2C]/30 transition-all">
            {/* Avatar viết tắt dạng tròn xịn sò giống hình */}
            <div className="h-14 w-14 rounded-full bg-[#FF6B2C] text-foreground grid place-items-center font-bold text-base shadow-md shrink-0">
                {initials}
            </div>

            <div>
                <div className="font-bold text-lg text-foreground leading-tight">{name}</div>
                <div className="text-sm text-[#A39690] mt-1 font-medium">{role}</div>
            </div>
        </div>
    );
}