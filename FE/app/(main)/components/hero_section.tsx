import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroVariableTitle } from "./hero_variable_title";

export default function Hero() {
    return (
        <section className="relative overflow-hidden pt-32 pb-28">
            {/* Background Grid */}
            <div className="absolute inset-0 seal-grid opacity-40" />

            {/* Orange Glow */}
            <div className="absolute top-24 left-1/2 -translate-x-1/2 h-[38rem] w-[58rem] rounded-full bg-orange/20 blur-[160px] animate-seal-pulse" />

            {/* Floating Particles */}
            {Array.from({ length: 14 }).map((_, i) => (
                <span
                    key={i}
                    className="absolute rounded-full bg-orange/60 animate-seal-float"
                    style={{
                        left: `${(i * 73) % 100}%`,
                        top: `${20 + ((i * 41) % 60)}%`,
                        width: `${3 + (i % 3)}px`,
                        height: `${3 + (i % 3)}px`,
                        opacity: 0.4,
                        animationDelay: `${i * 0.3}s`,
                    }}
                />
            ))}

            <div className="relative z-10 mx-auto max-w-7xl px-6 text-center">
                {/* Top Badge */}
                <div className="inline-flex items-center gap-2 rounded-full border border-orange/20 bg-card px-4 py-2 backdrop-blur-xl">
                    <span className="h-2 w-2 rounded-full bg-orange animate-pulse" />

                    <span className="text-[13px] font-medium text-orange">
                        SEAL Summer 2026
                    </span>

                    <span className="text-[13px] text-muted-foreground">
                        • Registration open until Jul 30
                    </span>
                </div>

                {/* Heading */}
                <HeroVariableTitle />

                {/* Description */}
                <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                    The annual academic hackathon series at FPT University Ho Chi Minh
                    City. Three seasons. One league. Build, ship and prove your craft.
                </p>

                {/* Actions */}
                <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                    <Button asChild variant="orange" size="auto" className="rounded-full px-7 py-3">
                        <Link
                            href="/register"
                        >
                            Join Competition →
                        </Link>
                    </Button>
                    <Button
                        asChild
                        variant="glass"
                        size="auto"
                        className="rounded-full px-7 py-3"
                    >
                        <Link href="/events">
                            Explore Events
                        </Link>
                    </Button>

                </div>

                {/* Dashboard Preview */}
                <div className="relative mx-auto mt-24 max-w-5xl">
                    {/* Glow */}
                    <div className="absolute -top-10 left-1/2 h-40 w-[90%] -translate-x-1/2 bg-orange/20 blur-[90px]" />

                    {/* Card */}
                    <div className="relative overflow-hidden rounded-[32px] border border-border bg-card backdrop-blur-2xl seal-glow">
                        {/* Header */}
                        <div className="flex items-center gap-2 border-b border-border px-5 py-4 text-xs text-muted-foreground">
                            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                            <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />

                            <span className="ml-3">
                                seal://dashboard/spring-2026
                            </span>

                            <span className="ml-auto text-orange">
                                ● LIVE
                            </span>
                        </div>

                        {/* Stats */}
                        <div className="grid gap-px bg-border md:grid-cols-3">
                            {[
                                {
                                    key: "TEAMS REGISTERED",
                                    value: "248",
                                    desc: "+34 today",
                                },
                                {
                                    key: "ACTIVE MENTORS",
                                    value: "62",
                                    desc: "FPTU + Industry",
                                },
                                {
                                    key: "PRIZE POOL",
                                    value: "₫420M",
                                    desc: "Across 3 seasons",
                                },
                            ].map((item) => (
                                <div
                                    key={item.key}
                                    className="bg-background/70 p-8 text-left"
                                >
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                        {item.key}
                                    </div>

                                    <div className="mt-3 text-4xl font-bold text-gradient-orange">
                                        {item.value}
                                    </div>

                                    <div className="mt-2 text-xs text-muted-foreground">
                                        {item.desc}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
