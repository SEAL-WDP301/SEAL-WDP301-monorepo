"use client";

import { useEffect, Suspense } from "react";
import { useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { axiosClient } from "@/lib/axios";
import { Bell, MailOpen, Mail, Clock, Trash2, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { enqueueSnackbar } from "notistack";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

import { NotificationDynamicTemplate } from "@/components/home/notification-templates";

// ==========================================
// MAIN COMPONENT
// ==========================================

interface UserNotification {
  id: number;
  title: string;
  content: string;
  type?: string;
  actionUrl?: string | null;
  isRead: boolean;
  createdAt: string;
  event?: {
    id?: number;
    name?: string;
  } | null;
}

interface NotificationPage {
  data: UserNotification[];
  meta: {
    page: number;
    totalPages: number;
  };
}

function NotificationsContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const basePath = pathname;
  const isRoleNotificationPage =
    pathname.startsWith('/judge/') || pathname.startsWith('/mentor/');

  const idParam = searchParams.get('id');

  const { 
    data, 
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['userNotifications'],
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) => {
      const res = await axiosClient.get(`/notifications?page=${pageParam}&limit=25`);
      return res.data as NotificationPage;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.meta.page < lastPage.meta.totalPages) {
        return lastPage.meta.page + 1;
      }
      return undefined;
    }
  });

  const notifications = data?.pages.flatMap((page) => page.data) || [];
  const requestedId = idParam ? Number.parseInt(idParam, 10) : null;
  const selectedNotification = requestedId
    ? notifications.find((notification) => notification.id === requestedId)
    : notifications[0];

  // Mutations
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userNotifications'] });
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await axiosClient.patch('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userNotifications'] });
      enqueueSnackbar("All have been marked as read.", { variant: 'success' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await axiosClient.delete(`/notifications/${id}`);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['userNotifications'] });
      if (selectedNotification?.id === id) {
        router.replace(basePath);
      }
      enqueueSnackbar("Notification removed", { variant: 'info' });
    }
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      await axiosClient.delete('/notifications/all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userNotifications'] });
      router.replace(basePath);
      enqueueSnackbar("All notification have been deleted", { variant: 'info' });
    }
  });

  useEffect(() => {
    if (idParam && selectedNotification && !selectedNotification.isRead) {
      markAsReadMutation.mutate(selectedNotification.id);
    }
    // Marking the selected notification is intentionally keyed to the URL selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam, selectedNotification?.id, selectedNotification?.isRead]);

  const handleSelectNotification = (notif: UserNotification) => {
    router.replace(`${basePath}?id=${notif.id}`);
    if (!notif.isRead) {
      markAsReadMutation.mutate(notif.id);
    }
  };



  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-background">
      {/* Page Header */}
      <div
        className={cn(
          "px-6 py-4",
          isRoleNotificationPage
            ? "bg-transparent pb-6"
            : "border-b border-border bg-card/50"
        )}
      >
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bell className="w-6 h-6 text-orange-500" />
          Notification Center
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Stay updated with the latest announcements, notifications, and event schedules.</p>
      </div>

      {/* Main Inbox Layout */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left Column: Notification List */}
        <div className="w-1/3 min-w-[320px] max-w-[400px] border-r border-border bg-card/20 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-border/50 sticky top-0 bg-background/95 backdrop-blur z-10 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">All notifications</h2>
              <span className="bg-orange-500/10 text-orange-600 text-xs px-2 py-0.5 rounded-full font-bold">
                {notifications.length}
              </span>
            </div>
            
            {notifications.length > 0 && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 text-xs h-8 text-muted-foreground"
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending || notifications.every((notification) => notification.isRead)}
                >
                  <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                  Mark all read
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-xs h-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete all notifications?")) {
                      deleteAllMutation.mutate();
                    }
                  }}
                  disabled={deleteAllMutation.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
          
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
              <Bell className="w-12 h-12 mb-3 opacity-20" />
              <p>No notifications available.</p>
            </div>
          ) : (
            <div 
              className="flex-1 overflow-y-auto p-2 space-y-1"
              onScroll={(e) => {
                const target = e.target as HTMLDivElement;
                if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
                  if (hasNextPage && !isFetchingNextPage) fetchNextPage();
                }
              }}
            >
              {notifications.map((notif) => {
                const isSelected = selectedNotification?.id === notif.id;
                return (
                  <div key={notif.id} className="relative group">
                    <button
                      onClick={() => handleSelectNotification(notif)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl transition-all duration-200 border border-transparent",
                        isSelected
                          ? "bg-muted shadow-sm border-border/50" 
                          : "hover:bg-muted/50",
                        !notif.isRead && !isSelected ? "bg-orange-500/5 border-orange-500/20" : ""
                      )}
                    >
                      <div className="flex justify-between items-start mb-2 pr-6">
                        <div className="flex items-center gap-2">
                          {!notif.isRead ? (
                            <Mail className="w-4 h-4 text-orange-500 shrink-0" />
                          ) : (
                            <MailOpen className={cn("w-4 h-4 shrink-0", isSelected ? "text-orange-500" : "text-muted-foreground")} />
                          )}
                          <span className="text-xs font-semibold text-muted-foreground truncate max-w-[120px]" title={notif.event?.name || 'SEAL System'}>
                            {notif.event?.name || 'SEAL System'}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      
                      <h3 className={cn(
                        "text-sm line-clamp-2 leading-snug",
                        !notif.isRead ? "font-bold text-foreground" : "font-medium text-foreground/80"
                      )}>
                        {notif.title}
                      </h3>
                    </button>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(notif.id);
                      }}
                      className="absolute top-4 right-3 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 p-1 rounded-md"
                      title="Delete notification"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {isFetchingNextPage && (
                <div className="p-4 text-center text-xs text-muted-foreground animate-pulse">
                  Loading more...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Detailed View */}
        <div className="flex-1 bg-background overflow-y-auto relative">
          {selectedNotification ? (
            <div className="max-w-4xl mx-auto p-8 md:p-12">
              
              {/* Email Header Style */}
              <div className="mb-8 pb-6 border-b border-border/50">
                <div className="flex justify-between items-start mb-4">
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
                    {selectedNotification.title}
                  </h1>
                </div>
                
                <div className="flex items-center justify-between bg-muted/30 p-4 rounded-xl border border-border/30">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center border border-orange-500/30 shrink-0">
                      <span className="text-orange-600 font-bold text-lg">
                        {selectedNotification.event?.name ? selectedNotification.event.name.charAt(0).toUpperCase() : 'S'}
                      </span>
                    </div>
                    <div>
                      {selectedNotification.event?.id ? (
                        <Link href={`/home/events/${selectedNotification.event.id}`} className="font-semibold text-foreground hover:text-orange-500 hover:underline transition-colors">
                          {selectedNotification.event.name}
                        </Link>
                      ) : (
                        <p className="font-semibold text-foreground">{selectedNotification.event?.name || 'SEAL System'}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">To: You</p>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-muted-foreground">
                      {format(new Date(selectedNotification.createdAt), "dd/MM/yyyy, HH:mm")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dynamic Template Render */}
              <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:text-foreground">
                <NotificationDynamicTemplate notification={selectedNotification} />
              </div>
              
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <MailOpen className="w-16 h-16 opacity-20 mb-4" />
              <p>Select a notification to view its details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NotificationsContent />
    </Suspense>
  );
}
