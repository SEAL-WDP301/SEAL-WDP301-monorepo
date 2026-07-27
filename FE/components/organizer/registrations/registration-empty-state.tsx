import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
export function RegistrationEmptyState({ onReset }: { onReset: () => void }) { return <div className="grid min-h-72 place-items-center text-center"><div><Inbox className="mx-auto size-9 text-muted-foreground" /><h3 className="mt-3 font-semibold">No registrations found.</h3><p className="mt-1 text-sm text-muted-foreground">Try changing the filters or select another event.</p><Button variant="outline" className="mt-4" onClick={onReset}>Reset filters</Button></div></div>; }
