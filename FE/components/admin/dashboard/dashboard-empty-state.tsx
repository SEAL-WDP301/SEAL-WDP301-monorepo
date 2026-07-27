import { Inbox } from "lucide-react";
export function DashboardEmptyState({ message }: { message: string }) {
  return <div className="grid min-h-56 place-items-center text-center"><div><Inbox className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">{message}</p></div></div>;
}
