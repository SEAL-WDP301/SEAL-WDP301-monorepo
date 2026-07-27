import { Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";

type SubmissionsHeaderProps = {
    countdown: string;
};

export function SubmissionsHeader({ countdown }: SubmissionsHeaderProps) {
    return (
        <header className="border-b border-border pb-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="text-sm font-medium uppercase tracking-[0.3em] text-orange-400">
                        Team Workspace
                    </p>
                    <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
                        Submissions
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Upload and manage your team deliverables
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Badge>
                        Semi Final
                    </Badge>
                    <Badge variant="success">
                        Submission Open
                    </Badge>
                    <div className="flex h-9 items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 text-sm font-semibold text-orange-300">
                        <Clock3 className="h-4 w-4" />
                        {countdown}
                    </div>
                </div>
            </div>
        </header>
    );
}
