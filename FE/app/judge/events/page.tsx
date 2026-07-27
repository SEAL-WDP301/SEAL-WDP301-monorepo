import EventsList from "./components/event-list";

export default function JudgeEventsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="mt-3 text-5xl font-bold tracking-tight text-muted-foreground">
                    Assigned Events
                </h1>

                <p className="mt-2 text-sm text-muted-foreground">
                    Active hackathon events assigned to you for evaluation.
                </p>
            </div>

            <EventsList />
        </div>
    );
}