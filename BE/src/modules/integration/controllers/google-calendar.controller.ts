import {
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { Role } from "../../../common/enums/role.enum";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { GoogleCalendarService } from "../services/google-calendar.service";

@ApiTags("Google Calendar Integration")
@Controller("integrations/google")
export class GoogleCalendarController {
  constructor(
    private readonly service: GoogleCalendarService,
    private readonly config: ConfigService,
  ) {}

  @Post("authorize-url")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiOperation({ summary: "Create a Google Calendar consent URL" })
  authorize(@CurrentUser("id") userId: string) {
    return this.service.createAuthorizationUrl(Number(userId));
  }

  @Get("status")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  status(@CurrentUser("id") userId: string) {
    return this.service.getStatus(Number(userId));
  }

  @Delete("disconnect")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  async disconnect(@CurrentUser("id") userId: string) {
    await this.service.disconnect(Number(userId));
    return { message: "Google Calendar disconnected" };
  }

  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") error: string | undefined,
    @Res() response: Response,
  ) {
    const frontend = this.config.get<string>("app.frontendUrl");
    const callbackUrl = `${frontend}/organizer/integrations/google/callback`;
    if (error || !code || !state) {
      return response.redirect(`${callbackUrl}?status=error`);
    }
    try {
      await this.service.handleCallback(code, state);
      return response.redirect(`${callbackUrl}?status=connected`);
    } catch {
      return response.redirect(`${callbackUrl}?status=error`);
    }
  }
}
