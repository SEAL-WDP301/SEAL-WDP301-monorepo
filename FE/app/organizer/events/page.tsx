"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { Plus, Search, Calendar, CalendarClock, Users, Trophy, Trash2, Loader2, Pencil } from "lucide-react";
import { format } from "date-fns"
import { enqueueSnackbar } from "notistack";

import {
    deleteOrganizerEvent,
    getOrganizerEvents,
    type EventStatus,
    type OrganizerEvent,
} from "@/lib/api/organizer-events.api";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

const statusFilters: Array<"all" | EventStatus> = ["all", "draft", "active", "ongoing", "closed"];

export default function OrganizerEventsPage() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | EventStatus>("all");
    const [eventToDelete, setEventToDelete] = useState<OrganizerEvent | null>(null);

    const { data: events, isLoading, isError } = useQuery({
        queryKey: ['organizerEvents'],
        queryFn: getOrganizerEvents,
    });

    const deleteMutation = useMutation({
        mutationFn: (eventId: number) => deleteOrganizerEvent(eventId),
        onSuccess: () => {
            enqueueSnackbar("Event deleted successfully", { variant: "success" });
            setEventToDelete(null);
            queryClient.invalidateQueries({ queryKey: ["organizerEvents"] });
        },
        onError: (error: { response?: { data?: { message?: string } } }) => {
            enqueueSnackbar(error.response?.data?.message || "Failed to delete event", { variant: "error" });
        },
    });

    const filteredEvents = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        return (events || []).filter((event) => {
            const matchesStatus = statusFilter === "all" || event.status === statusFilter;
            const matchesSearch =
                !normalizedSearch ||
                event.name.toLowerCase().includes(normalizedSearch) ||
                event.description?.toLowerCase().includes(normalizedSearch) ||
                `${event.season} ${event.year}`.toLowerCase().includes(normalizedSearch);

            return matchesStatus && matchesSearch;
        });
    }, [events, searchTerm, statusFilter]);

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'active': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
            case 'ongoing': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
            case 'closed': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
            default: return 'bg-muted text-muted-foreground border-border';
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Events Management</h1>
                    <p className="text-muted-foreground mt-1">Create, manage and monitor all your hackathons.</p>
                </div>
                <Link href="/organizer/events/create">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm gap-2">
                        <Plus className="h-4 w-4" />
                        Create New Event
                    </Button>
                </Link>
            </div>

            {/* Filters Bar */}
            <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input 
                        type="text" 
                        placeholder="Search events..." 
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                </div>
                <div className="flex gap-2">
                    {statusFilters.map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setStatusFilter(filter)}
                            className={`px-4 py-2 text-sm font-medium border rounded-lg transition-colors capitalize ${
                                filter === statusFilter
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
                </div>
            ) : isError ? (
                <div className="p-8 text-center text-red-500 bg-red-500/10 rounded-xl border border-red-500/20">
                    Failed to load events. Please check your permissions or network.
                </div>
            ) : events?.length === 0 ? (
                <div className="p-12 text-center bg-card border border-dashed border-border rounded-xl">
                    <Trophy className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-1">No events found</h3>
                    <p className="text-muted-foreground mb-6">You haven&apos;t created any events yet.</p>
                    <Link href="/organizer/events/create">
                        <Button variant="outline" className="gap-2">
                            <Plus className="h-4 w-4" />
                            Create your first event
                        </Button>
                    </Link>
                </div>
            ) : filteredEvents.length === 0 ? (
                <div className="p-12 text-center bg-card border border-dashed border-border rounded-xl">
                    <Search className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-1">No matching events</h3>
                    <p className="text-muted-foreground">Try another keyword or status filter.</p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {filteredEvents.map((event) => {
                        const imageUrl = event.imageUrl || event.image_url;

                        return (
                        <div key={event.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:border-blue-500/30 transition-all duration-300 group flex flex-col">
                            <div className="relative aspect-video bg-muted overflow-hidden">
                                {imageUrl ? (
                                    <Image
                                        src={imageUrl}
                                        alt={event.name}
                                        fill
                                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center text-sm font-medium text-muted-foreground">
                                        No cover image
                                    </div>
                                )}
                            </div>
                            <div className="p-6 flex-1">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(event.status)} uppercase tracking-wider`}>
                                        {event.status}
                                    </div>
                                    <div className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                                        {event.season} {event.year}
                                    </div>
                                </div>
                                
                                <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-blue-500 transition-colors line-clamp-2">
                                    {event.name}
                                </h3>
                                <p className="text-sm text-muted-foreground line-clamp-2 mb-6">
                                    {event.description}
                                </p>

                                <div className=" space-y-3">
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        <Calendar className="h-4 w-4 mr-2" />
                                        <span>Reg: {event.registrationDeadline ? format(new Date(event.registrationDeadline), 'MMM dd, yyyy') : 'TBA'}</span>
                                    </div>
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        <CalendarClock className="h-4 w-4 mr-2" />
                                        <span>End: {event.endDate ? format(new Date(event.endDate), 'MMM dd, yyyy') : 'TBA'}</span>
                                    </div>
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        <Users className="h-4 w-4 mr-2" />
                                        <span>{event.tracks?.length || 0} Tracks</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="border-t border-border p-4 bg-muted/30 flex justify-between items-center">
                                <div className="text-xs text-muted-foreground">
                                    ID #{event.id}
                                </div>
                                <div className="flex items-center gap-2">
                                    {event.status === 'draft' ? (
                                        <Link href={`/organizer/events/${event.id}/edit`}>
                                            <Button size="sm" variant="outline" className="border-blue-500/20 hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-900/20">
                                                <Pencil className="h-3.5 w-3.5" />
                                                Edit
                                            </Button>
                                        </Link>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            title="Event must have Draft status before it can be edited"
                                            className="border-gray-500/20 text-gray-500"
                                            onClick={() => enqueueSnackbar("Event must have Draft status before it can be edited.", { variant: "warning" })}
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                            Edit
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="gap-1.5"
                                        onClick={() => setEventToDelete(event)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete
                                    </Button>
                                    <Link href={`/organizer/events/${event.id}`}>
                                        <Button size="sm" variant="outline" className="border-blue-500/20 hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-900/20">
                                            Manage
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}

            <Dialog open={!!eventToDelete} onOpenChange={(open) => !open && setEventToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete event</DialogTitle>
                        <DialogDescription>
                            This will permanently delete {eventToDelete?.name}. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEventToDelete(null)} disabled={deleteMutation.isPending}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => eventToDelete && deleteMutation.mutate(eventToDelete.id)}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
