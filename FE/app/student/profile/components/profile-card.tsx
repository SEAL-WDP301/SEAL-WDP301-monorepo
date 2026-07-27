import { Camera, GraduationCap, Trophy } from "lucide-react";
import { FaGithub, FaFacebookF } from "react-icons/fa";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";


export function ProfileCard() {
    return (
        <Card glow className="overflow-hidden border-orange-500/20 bg-card">
            <CardContent className="p-8 text-center">
                <div className="relative mx-auto w-fit">
                    <div className="absolute inset-0 rounded-full bg-orange-500/30 blur-2xl" />
                    <Avatar className="relative mx-auto h-28 w-28 border border-orange-500/30 ring-4 ring-primary/25">
                        <AvatarFallback className="bg-gradient-to-br from-[#ff8a3d] to-[#f37021] text-3xl font-black text-foreground">
                            MK
                        </AvatarFallback>
                    </Avatar>

                    <button
                        type="button"
                        aria-label="Change avatar"
                        className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border border-orange-500/30 bg-card text-orange-400 shadow-lg shadow-orange-500/10 transition hover:-translate-y-0.5 hover:border-orange-500/50 hover:bg-orange-500/10"
                    >
                        <Camera className="h-4 w-4 text-orange-400" />
                    </button>
                </div>

                <h2 className="mt-5 text-xl font-bold text-foreground">
                    Nguyễn Minh Khoa
                </h2>

                <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <GraduationCap className="h-3 w-3" />
                    FPT University · HCMC · K17
                </div>

                <div className="mt-3 flex items-center justify-center gap-2">
                    <Badge className="border border-primary/30 bg-primary/15 text-primary">
                        <Trophy className="h-3 w-3" />
                        Champion
                    </Badge>

                    <Badge variant="outline" className="border-border bg-muted text-foreground">
                        Lv. 14
                    </Badge>
                </div>

                {/* STATS */}
                <div className="mt-5 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    {[
                        { label: "EVENTS", value: 6 },
                        { label: "TEAMS", value: 3 },
                        { label: "AWARDS", value: 4 },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className="rounded-xl border border-border bg-muted/50 py-2.5"
                        >
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                {item.label}
                            </div>

                            <div className="text-base font-bold text-primary">
                                {item.value}
                            </div>
                        </div>
                    ))}
                </div>

                {/* SOCIAL */}
                <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                        type="button"
                        aria-label="GitHub profile"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground transition hover:-translate-y-0.5 hover:border-orange-500/40 hover:text-orange-400"
                    >
                        <FaGithub className="h-4 w-4" />
                    </button>

                    <button
                        type="button"
                        aria-label="LinkedIn profile"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground transition hover:-translate-y-0.5 hover:border-orange-500/40 hover:text-orange-400"
                    >
                        <FaFacebookF className="h-4 w-4" />
                    </button>
                </div>
            </CardContent>
        </Card>
    );
}
