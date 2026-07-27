import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
export function RegistrationErrorState({ onRetry }: { onRetry: () => void }) { return <div className="grid min-h-72 place-items-center text-center"><div><TriangleAlert className="mx-auto size-9 text-red-400" /><h3 className="mt-3 font-semibold">Unable to load registrations.</h3><Button variant="outline" className="mt-4" onClick={onRetry}>Retry</Button></div></div>; }
