import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger, UseGuards } from "@nestjs/common";
import { WsJwtGuard } from "../../auth/guards/ws-jwt.guard";
import { PrismaService } from "../../../database/prisma/prisma.service";

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
  },
})
export class FeedbackGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger("FeedbackGateway");

  constructor(private readonly prisma: PrismaService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("join_team_room")
  async handleJoinTeamRoom(client: Socket, teamId: number) {
    const user = client.data.user;
    if (!user || !teamId) return;

    const userId = Number(user.id || user.sub);
    const role = user.role;

    // Admin & Organizer have oversight access
    if (role !== "admin" && role !== "organizer") {
      if (role === "student") {
        const team = await this.prisma.team.findUnique({
          where: { id: Number(teamId) },
          select: {
            leaderId: true,
            members: {
              where: { userId, status: "accepted" },
              select: { id: true },
            },
          },
        });
        if (!team || (team.leaderId !== userId && team.members.length === 0)) {
          this.logger.warn(
            `User ${user.email} unauthorized to join feedback room: team_${teamId}`,
          );
          return;
        }
      } else if (role === "stakeholder" || role === "mentor") {
        const assignment = await this.prisma.mentorAssignment.findFirst({
          where: { mentorId: userId, teamId: Number(teamId) },
          select: { id: true },
        });
        if (!assignment) {
          this.logger.warn(
            `Mentor ${user.email} unauthorized to join feedback room: team_${teamId}`,
          );
          return;
        }
      } else {
        return;
      }
    }

    client.join(`team_${teamId}`);
    this.logger.log(
      `Client ${client.id} (User: ${user.email}) joined room: team_${teamId}`,
    );
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("leave_team_room")
  handleLeaveTeamRoom(client: Socket, teamId: number) {
    client.leave(`team_${teamId}`);
    this.logger.log(`Client ${client.id} left room: team_${teamId}`);
  }

  notifyFeedbackUpdated(teamId: number) {
    this.server.to(`team_${teamId}`).emit("feedback_updated");
  }
}
