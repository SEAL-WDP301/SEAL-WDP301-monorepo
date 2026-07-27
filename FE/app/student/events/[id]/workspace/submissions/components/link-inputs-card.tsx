import { CheckCircle2, Code2, ExternalLink, Link2, Presentation, TriangleAlert } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";

import type { LinkField } from "../mock-data";

const linkIcons = [Code2, ExternalLink, Presentation, Link2];

type LinkInputsCardProps = {
    fields: LinkField[];
};

export function LinkInputsCard({ fields }: LinkInputsCardProps) {
    return (
        <GlassCard className="rounded-[24px] bg-card p-6 hover:-translate-y-1">
            <div className="mb-5">
                <h2 className="text-lg font-semibold text-foreground">
                    Project Links
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Add repository, demo, slides, and prototype references.
                </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                {fields.map((field, index) => {
                    const Icon = linkIcons[index];
                    const valid = field.status === "valid";

                    return (
                        <label
                            key={field.label}
                            className="rounded-[20px] border border-border bg-white/[0.035] p-4"
                        >
                            <span className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                {field.label}
                                {valid ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                ) : (
                                    <TriangleAlert className="h-4 w-4 text-orange-300" />
                                )}
                            </span>
                            <div className="relative">
                                <Icon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    defaultValue={field.value}
                                    placeholder={field.placeholder}
                                    className="h-11 rounded-2xl border-border bg-muted pl-11"
                                />
                            </div>
                        </label>
                    );
                })}
            </div>
        </GlassCard>
    );
}
