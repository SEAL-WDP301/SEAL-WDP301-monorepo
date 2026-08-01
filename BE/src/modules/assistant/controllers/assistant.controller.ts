import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { OptionalJwtAuthGuard } from "../../../common/guards/optional-jwt-auth.guard";
import { AssistantChatDto } from "../dto/assistant-chat.dto";
import { AssistantService } from "../services/assistant.service";

@ApiTags("Assistant")
@Controller("assistant")
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post("chat")
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      "Role-aware SEAL assistant (student/mentor/judge/organizer) — DB-grounded, no unsafe side effects",
  })
  async chat(
    @Body() dto: AssistantChatDto,
    @CurrentUser() user: { id: number; role?: string } | null,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      "unknown";

    return {
      message: "Assistant reply",
      data: await this.assistantService.chat(dto, user, { ip }),
    };
  }
}
