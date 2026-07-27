import { FileText, UploadCloud, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";

import type { UploadedFile } from "../mock-data";

type UploadAreaCardProps = {
    file: UploadedFile;
};

export function UploadAreaCard({ file }: UploadAreaCardProps) {
    return (
        <GlassCard className="rounded-[24px] bg-card p-6 hover:-translate-y-1">
            <div className="mb-5">
                <h2 className="text-lg font-semibold text-foreground">
                    Upload Deliverables
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Add draft files or final package assets for the current round.
                </p>
            </div>

            <div className="rounded-[24px] border border-dashed border-orange-500/30 bg-orange-500/5 p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-500/25 bg-orange-500/10 text-orange-400">
                    <UploadCloud className="h-7 w-7" />
                </div>
                <p className="mt-4 text-base font-semibold text-foreground">
                    Drag & drop your files here
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    PDF, ZIP, PPTX up to 100MB
                </p>
                <Button variant="outline" className="mt-5 rounded-2xl border-border bg-muted">
                    Choose File
                </Button>
            </div>

            <div className="mt-5 rounded-[20px] border border-border bg-white/[0.035] p-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="font-semibold text-foreground">
                                {file.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {file.size}
                            </p>
                        </div>
                    </div>

                    <Button variant="ghost" size="icon-sm" className="rounded-xl text-muted-foreground hover:bg-red-500/10 hover:text-red-300">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="mt-4">
                    <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                        <span>Uploading</span>
                        <span>{file.progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-[#ff8a3d] to-[#f37021]"
                            style={{ width: `${file.progress}%` }}
                        />
                    </div>
                </div>
            </div>
        </GlassCard>
    );
}
