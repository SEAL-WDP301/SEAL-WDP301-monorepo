import { EventItem } from "./constants";
import { EventCard } from "./event-card";

interface EventsGridProps {
    events: EventItem[];
}

export function EventsGrid({
    events,
}: EventsGridProps) {
    return (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => (
                <EventCard
                    key={event.name}
                    event={event}
                />
            ))}
        </div>
    );
}