import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
export function DashboardErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="grid min-h-56 place-items-center text-center"><div><TriangleAlert className="mx-auto size-8 text-red-400" /><p className="mt-3 text-sm">Unable to load this section.</p><Button variant="outline" className="mt-4" onClick={onRetry}>Retry</Button></div></div>;
}
