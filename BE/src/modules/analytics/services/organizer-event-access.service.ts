import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";

@Injectable()
export class OrganizerEventAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccessibleEventIds(organizerId: number): Promise<number[]> {
    const events = await this.prisma.event.findMany({
      where: { createdById: organizerId },
      select: { id: true },
    });
    return events.map(({ id }) => id);
  }

  async ensureEventAccess(organizerId: number, eventId: number): Promise<void> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { createdById: true },
    });
    if (!event) {
      throw new NotFoundException({
        errorCode: "EVENT_NOT_FOUND",
        message: "Event not found",
      });
    }
    if (event.createdById !== organizerId) {
      throw new ForbiddenException({
        errorCode: "ORGANIZER_EVENT_ACCESS_DENIED",
        message: "You do not have permission to access this event",
      });
    }
  }
}
