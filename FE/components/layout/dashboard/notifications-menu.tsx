"use client";

import { axiosClient } from '@/lib/axios';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient, useInfiniteQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/lib/stores/auth.store';
import { useAdminSocket } from '@/hooks/use-admin-socket';
import { enqueueSnackbar } from 'notistack';
import { useEffect } from 'react';

interface UserNotification {
  id: number;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationPage {
  data: UserNotification[];
  meta: {
    page: number;
    totalPages: number;
  };
}

export function NotificationsMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const { socket } = useAdminSocket({ userId: user?.id });

  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (data: any) => {
      const titleText = data.title || "New Notification";

      enqueueSnackbar(titleText, { 
        variant: "info",
        persist: true,
      });
      queryClient.invalidateQueries({ queryKey: ['userNotifications'] });
    };

    socket.on("notification.new", handleNewNotification);

    return () => {
      socket.off("notification.new", handleNewNotification);
    };
  }, [socket, queryClient]);

  const judgeEventMatch = pathname.match(/^\/judge\/events\/([^/]+)/);
  const mentorEventMatch = pathname.match(/^\/mentor\/events\/([^/]+)/);
  const notificationsHref = pathname.startsWith('/judge')
    ? '/judge/notifications'
    : mentorEventMatch
      ? `/mentor/events/${mentorEventMatch[1]}/notifications`
      : pathname.startsWith('/mentor')
        ? '/mentor/notifications'
        : '/home/notifications';

  const { data, isLoading } = useInfiniteQuery({
    queryKey: ['userNotifications'],
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) => {
      const res = await axiosClient.get(`/notifications?page=${pageParam}&limit=25`);
      const responseData = res.data;
      if (responseData && responseData.meta) {
        return responseData as NotificationPage;
      }
      if (Array.isArray(responseData)) {
        return {
          data: responseData,
          meta: { page: 1, limit: responseData.length, total: responseData.length, totalPages: 1 },
        };
      }
      return {
        data: responseData?.data || [],
        meta: responseData?.meta || { page: 1, limit: 25, total: 0, totalPages: 1 },
      };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage?.meta?.page != null && lastPage?.meta?.totalPages != null) {
        if (lastPage.meta.page < lastPage.meta.totalPages) {
          return lastPage.meta.page + 1;
        }
      }
      return undefined;
    },
  });

  const handleNotificationClick = async (notif: UserNotification) => {
    if (!notif.isRead) {
      try {
        await axiosClient.patch(`/notifications/${notif.id}/read`);
        queryClient.invalidateQueries({ queryKey: ['userNotifications'] });
      } catch (err) {
        console.error("Failed to mark notification as read", err);
      }
    }
    router.push(`${notificationsHref}?id=${notif.id}`);
  };

  const notifications = (
    data?.pages.flatMap((page) => (Array.isArray(page?.data) ? page.data : [])) || []
  ).filter((n): n is UserNotification => Boolean(n && typeof n === "object" && "id" in n));

  const unreadCount = notifications.filter((notification) => !notification?.isRead).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-2">
        <DropdownMenuLabel className="font-bold flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <span className="bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 text-xs px-2 py-0.5 rounded-full">
              {unreadCount} new
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {isLoading ? (
          <div className="py-4 text-center text-sm text-muted-foreground">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Bell className="h-8 w-8 opacity-20" />
            <p>No notifications</p>
          </div>
        ) : (
          <div className="max-h-[350px] overflow-y-auto space-y-1 pr-1">
            {notifications.map((notif) => (
              <DropdownMenuItem 
                key={notif.id} 
                onClick={() => handleNotificationClick(notif)}
                className={`p-3 rounded-lg flex flex-col items-start gap-1 cursor-pointer focus:bg-muted ${!notif.isRead ? 'bg-orange-50/50 dark:bg-orange-950/20' : ''}`}
              >
                <div className="flex justify-between items-start w-full gap-2">
                  <p className={`text-sm leading-tight text-foreground ${!notif.isRead ? 'font-bold' : 'font-medium'}`}>
                    {notif.title}
                  </p>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                  {notif.content}
                </p>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        
        {notifications.length > 0 && (
          <>
            <div className="border-t border-border bg-muted/30">
            <Link href={notificationsHref} className="block w-full text-center text-xs font-medium text-blue-500 hover:text-blue-600 hover:underline p-1">
              View all notifications
            </Link>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
