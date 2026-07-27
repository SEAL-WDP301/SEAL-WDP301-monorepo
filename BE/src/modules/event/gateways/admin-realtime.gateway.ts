import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

@WebSocketGateway({
  namespace: "/admin-realtime",
  cors: {
    origin: "*", // allow all for hackathon prototype
  },
})
export class AdminRealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AdminRealtimeGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Admin/Organizer connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Admin/Organizer disconnected: ${client.id}`);
  }

  @SubscribeMessage("joinEvent")
  handleJoinEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: number },
  ) {
    const room = `admin-event-${data.eventId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
    return { event: "joined", room };
  }

  @SubscribeMessage("joinRound")
  handleJoinRound(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roundId: number },
  ) {
    const room = `admin-round-${data.roundId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
    return { event: "joined", room };
  }

  @SubscribeMessage("joinTeam")
  handleJoinTeam(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { teamId: number },
  ) {
    const room = `team-${data.teamId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
    return { event: "joined", room };
  }

  @SubscribeMessage("joinUser")
  handleJoinUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: number },
  ) {
    if (!data?.userId) return;
    const room = `user-${data.userId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined user room: ${room}`);
    return { event: "joined", room };
  }

  @OnEvent("notification.user.*")
  handleUserNotification(data: any) {
    if (!data) return;
    const userId = data.userId;
    if (userId) {
      const room = `user-${userId}`;
      this.server.to(room).emit("notification.new", data);
      this.logger.log(`Emitted notification.new to room ${room} for user ${userId}`);
    }
  }

  @OnEvent("team.registered")
  handleTeamRegistered(data: any) {
    if (!data.eventId) return;
    const room = `admin-event-${data.eventId}`;
    this.server.to(room).emit("team.registered", data);
    this.logger.log(
      `Emitted team.registered to ${room} for team ${data.teamName}`,
    );
  }

  @OnEvent("submission.created")
  handleSubmissionCreated(data: any) {
    if (!data.roundId) return;
    const room = `admin-round-${data.roundId}`;
    this.server.to(room).emit("submission.created", data);
    this.logger.log(
      `Emitted submission.created to ${room} for team ${data.teamName}`,
    );
  }

  @OnEvent("round.reminder_15m_triggered")
  handleRoundReminder15mTriggered(data: any) {
    this.server.emit("round.reminder_15m_triggered", data);
    if (data.eventId) {
      this.server.to(`admin-event-${data.eventId}`).emit("round.reminder_15m_triggered", data);
    }
    this.logger.log(`Emitted round.reminder_15m_triggered for round ${data.roundId}`);
  }

  @OnEvent("round.repos_frozen")
  handleRoundReposFrozen(data: any) {
    this.server.emit("round.repos_frozen", data);
    if (data.eventId) {
      this.server.to(`admin-event-${data.eventId}`).emit("round.repos_frozen", data);
    }
    this.logger.log(`Emitted round.repos_frozen for round ${data.roundId}`);
  }

  @OnEvent("job.progress")
  handleJobProgress(data: any) {
    this.server.emit("job.progress", data);
  }

  @OnEvent("job.failed")
  handleJobFailed(data: any) {
    this.server.emit("job.failed", data);
    this.logger.error(`Emitted job.failed event for queue ${data.queueName}: ${data.error}`);
  }
}
