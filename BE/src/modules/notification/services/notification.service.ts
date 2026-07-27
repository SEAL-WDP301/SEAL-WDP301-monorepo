import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Observable, fromEvent } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get notifications for the given user.
   */
  async getUserNotifications(userId: number, page: number = 1, limit: number = 25) {
    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        include: {
          event: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Stream real-time notifications via SSE.
   */
  streamNotifications(userId: number): Observable<MessageEvent> {
    // Lắng nghe các event nội bộ có dạng 'notification.user.<userId>'
    return fromEvent(this.eventEmitter, `notification.user.${userId}`).pipe(
      map(
        (payload: any) =>
          ({
            data: payload,
          }) as MessageEvent,
      ),
    );
  }

  /**
   * Mark a single notification as read.
   */
  async markNotificationAsRead(userId: number, notificationId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException("Notification not found");
    }
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllNotificationsAsRead(userId: number) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  /**
   * Delete a single notification.
   */
  async deleteNotification(userId: number, notificationId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException("Notification not found");
    }
    return this.prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  /**
   * Delete all notifications for a user.
   */
  async deleteAllNotifications(userId: number) {
    return this.prisma.notification.deleteMany({
      where: { userId },
    });
  }

  async createNotification(data: {
    userId: number;
    eventId?: number;
    type: string;
    title: string;
    content: string;
    actionUrl?: string;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        eventId: data.eventId,
        type: data.type as any,
        title: data.title,
        content: data.content,
        actionUrl: data.actionUrl,
        isEmailSent: true,
      },
    });
    this.eventEmitter.emit(`notification.user.${data.userId}`, notification);
    return notification;
  }

  async createManyNotifications(data: {
    userIds: number[];
    eventId?: number;
    type: string;
    title: string;
    content: string;
    actionUrl?: string;
  }) {
    const notifications = data.userIds.map((userId) => ({
      userId,
      eventId: data.eventId,
      type: data.type as any,
      title: data.title,
      content: data.content,
      actionUrl: data.actionUrl,
      isEmailSent: true,
    }));

    if (notifications.length > 0) {
      await this.prisma.notification.createMany({ data: notifications });
      
      // Need to find them to get the IDs, but for SSE we can just emit the payloads
      notifications.forEach((notif) => {
        this.eventEmitter.emit(`notification.user.${notif.userId}`, {
          ...notif,
          createdAt: new Date(),
          isRead: false,
        });
      });
    }
  }
}
