export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-20 animate-pulse rounded-2xl bg-muted/50" />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="h-[500px] animate-pulse rounded-2xl bg-muted/50" />
        <div className="h-[500px] animate-pulse rounded-2xl bg-muted/50" />
      </div>
    </div>
  );
}
