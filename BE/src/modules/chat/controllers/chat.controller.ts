import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { ChatService } from "../services/chat.service";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

@ApiTags("Chat")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get("teams/:teamId/messages")
  @ApiOperation({ summary: "Get chat messages for a team room" })
  @ApiQuery({ name: "cursor", required: false, type: String })
  async getTeamMessages(
    @CurrentUser("id") userId: string,
    @CurrentUser("role") role: string,
    @Param("teamId", ParseIntPipe) teamId: number,
    @Query("cursor") cursor?: string,
  ) {
    const messages = await this.chatService.getTeamMessages(
      Number(userId),
      role,
      teamId,
      cursor ? Number(cursor) : undefined,
    );
    return {
      message: "Chat messages retrieved",
      data: messages,
    };
  }
}
