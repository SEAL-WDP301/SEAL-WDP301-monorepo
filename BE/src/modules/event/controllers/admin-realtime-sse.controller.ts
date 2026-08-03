import {
  Controller,
  Sse,
  Param,
  ParseIntPipe,
  UseGuards,
  MessageEvent,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Observable } from "rxjs";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { Role } from "../../../common/enums/role.enum";
import { AdminRealtimeSseService } from "../services/admin-realtime-sse.service";

@ApiTags("Organizer/Realtime-SSE")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER, Role.ADMIN)
@Controller("organizer/realtime")
export class AdminRealtimeSseController {
  constructor(
    private readonly adminRealtimeSseService: AdminRealtimeSseService,
  ) {}

  @Sse("events/:eventId/stream")
  @ApiOperation({
    summary: "Stream real-time event updates (team registrations) for Organizer/Admin via SSE",
  })
  @ApiResponse({ status: 200, description: "Event SSE stream established" })
  streamEventUpdates(
    @Param("eventId", ParseIntPipe) eventId: number,
  ): Observable<MessageEvent> {
    return this.adminRealtimeSseService.streamEventUpdates(
      eventId,
    ) as Observable<MessageEvent>;
  }

  @Sse("rounds/:roundId/stream")
  @ApiOperation({
    summary: "Stream real-time round updates (submissions) for Organizer/Admin via SSE",
  })
  @ApiResponse({ status: 200, description: "Round SSE stream established" })
  streamRoundUpdates(
    @Param("roundId", ParseIntPipe) roundId: number,
  ): Observable<MessageEvent> {
    return this.adminRealtimeSseService.streamRoundUpdates(
      roundId,
    ) as Observable<MessageEvent>;
  }
}
