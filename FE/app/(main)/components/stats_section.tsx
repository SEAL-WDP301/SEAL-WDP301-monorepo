export default function Stats() {
    const items = [
        ["7", "Years Running"],
        ["1.8K+", "Alumni Hackers"],
        ["96", "Industry Partners"],
        ["52", "Winning Startups"],
    ];

    return (
        <section className="relative overflow-hidden border-y border-border bg-muted/20">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange/5 to-transparent" />

            <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 py-14 md:grid-cols-4">
                {items.map(([value, label]) => (
                    <div
                        key={label}
                        className="group text-center"
                    >
                        {/* Number */}
                        <div className="text-4xl font-bold tracking-tight text-gradient-orange md:text-5xl">
                            {value}
                        </div>

                        {/* Label */}
                        <div className="mt-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                            {label}
                        </div>

                        {/* Hover Line */}
                        <div className="mx-auto mt-4 h-[2px] w-0 bg-orange transition-all duration-300 group-hover:w-10" />
                    </div>
                ))}
            </div>
        </section>
    );
}
