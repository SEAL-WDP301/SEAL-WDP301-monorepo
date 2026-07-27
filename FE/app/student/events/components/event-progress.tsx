interface EventProgressProps {
    progress: number;
}

export function EventProgress({
    progress,
}: EventProgressProps) {
    return (
        <div className="mt-4">
            <div className="mb-2 flex justify-between text-[10px] text-zinc-500">
                <span>Round 1</span>
                <span>Round 2</span>
                <span>Round 3</span>
                <span>Final</span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}