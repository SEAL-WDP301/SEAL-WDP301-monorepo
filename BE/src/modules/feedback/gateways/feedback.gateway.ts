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

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("join_team_room")
  handleJoinTeamRoom(client: Socket, teamId: number) {
    const user = client.data.user;
    if (!user) return; // Add more specific team checks if needed
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
