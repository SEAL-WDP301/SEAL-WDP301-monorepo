import { PrismaService } from "@database/prisma/prisma.service";
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async validateUserTeamAccess(
    userId: number,
    role: string,
    teamId: number,
  ): Promise<boolean> {
    if (!userId || !teamId) return false;

    // Admin & Organizer have oversight access
    if (role === "admin" || role === "organizer") {
      return true;
    }

    if (role === "student") {
      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
        select: {
          id: true,
          leaderId: true,
          members: {
            where: {
              userId,
              status: "accepted",
            },
            select: { id: true },
          },
        },
      });

      if (!team) return false;
      return team.leaderId === userId || team.members.length > 0;
    }

    if (role === "stakeholder" || role === "mentor") {
      const assignment = await this.prisma.mentorAssignment.findFirst({
        where: { mentorId: userId, teamId },
        select: { id: true },
      });
      return Boolean(assignment);
    }

    return false;
  }

  async validateUserEventAccess(
    userId: number,
    role: string,
    eventId: number,
  ): Promise<boolean> {
    if (!userId || !eventId) return false;

    if (role === "admin" || role === "organizer") {
      return true;
    }

    return false;
  }

  async getTeamMessages(
    userId: number,
    role: string,
    teamId: number,
    cursorId?: number,
  ) {
    const hasAccess = await this.validateUserTeamAccess(userId, role, teamId);
    if (!hasAccess) {
      throw new ForbiddenException("You do not have permission to view this team's chat");
    }

    const team = await this.prisma.team.findUnique({ where: { id: teamId } });

    const messages = await this.prisma.teamMessage.findMany({
      where: { teamId },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
          },
        },
        reads: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      take: 20,
      skip: cursorId ? 1 : 0,
      cursor: cursorId ? { id: cursorId } : undefined,
      orderBy: { createdAt: "desc" },
    });

    messages.reverse();

    return messages.map((msg) => ({
      ...msg,
      sender: {
        ...msg.sender,
        role: msg.sender.id === team?.leaderId ? "Leader" : msg.sender.role,
      },
    }));
  }

  async saveMessage(teamId: number, senderId: number, content: string) {
    const message = await this.prisma.teamMessage.create({
      data: {
        teamId,
        senderId,
        content,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
          },
        },
        reads: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    const team = await this.prisma.team.findUnique({ where: { id: teamId } });

    return {
      ...message,
      eventId: team?.eventId,
      teamName: team?.name,
      sender: {
        ...message.sender,
        role:
          message.sender.id === team?.leaderId ? "Leader" : message.sender.role,
      },
    };
  }

  async markMessagesAsRead(teamId: number, userId: number) {
    // Find messages in the team room sent by others that haven't been read by this user
    const unreadMessages = await this.prisma.teamMessage.findMany({
      where: {
        teamId,
        senderId: { not: userId },
        reads: {
          none: {
            userId,
          },
        },
      },
      select: { id: true },
    });

    if (unreadMessages.length === 0) return [];

    // Create read records
    await this.prisma.teamMessageRead.createMany({
      data: unreadMessages.map((msg) => ({
        messageId: msg.id,
        userId,
      })),
      skipDuplicates: true,
    });

    const updatedMessages = await this.prisma.teamMessage.findMany({
      where: {
        id: { in: unreadMessages.map((m) => m.id) },
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            role: true,
          },
        },
        reads: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    const team = await this.prisma.team.findUnique({ where: { id: teamId } });

    return updatedMessages.map((msg) => ({
      ...msg,
      eventId: team?.eventId,
      sender: {
        ...msg.sender,
        role: msg.sender.id === team?.leaderId ? "Leader" : msg.sender.role,
      },
    }));
  }

  async editMessage(
    userId: number,
    role: string,
    messageId: number,
    content: string,
  ) {
    const message = await this.prisma.teamMessage.findUnique({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException("Message not found");

    if (
      message.senderId !== userId &&
      role !== "admin" &&
      role !== "organizer"
    ) {
      throw new ForbiddenException("You can only edit your own messages");
    }

    const updated = await this.prisma.teamMessage.update({
      where: { id: messageId },
      data: { content, isEdited: true },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true, role: true },
        },
        reads: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    const team = await this.prisma.team.findUnique({
      where: { id: updated.teamId },
    });
    return {
      ...updated,
      eventId: team?.eventId,
      sender: {
        ...updated.sender,
        role:
          updated.sender.id === team?.leaderId ? "Leader" : updated.sender.role,
      },
    };
  }

  async deleteMessage(userId: number, role: string, messageId: number) {
    const message = await this.prisma.teamMessage.findUnique({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException("Message not found");

    if (
      message.senderId !== userId &&
      role !== "admin" &&
      role !== "organizer"
    ) {
      throw new ForbiddenException("You can only delete your own messages");
    }

    const updated = await this.prisma.teamMessage.update({
      where: { id: messageId },
      data: { isDeleted: true },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true, role: true },
        },
        reads: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    const team = await this.prisma.team.findUnique({
      where: { id: updated.teamId },
    });
    return {
      ...updated,
      eventId: team?.eventId,
      sender: {
        ...updated.sender,
        role:
          updated.sender.id === team?.leaderId ? "Leader" : updated.sender.role,
      },
    };
  }
}
