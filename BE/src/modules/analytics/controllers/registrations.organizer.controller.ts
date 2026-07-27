import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { Role } from "../../../common/enums/role.enum";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RegistrationsOrganizerService } from "../services/registrations.organizer.service";

@ApiTags("Organizer Registrations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER, Role.ADMIN)
@Controller("organizer/registrations")
export class RegistrationsOrganizerController {
  constructor(private readonly service: RegistrationsOrganizerService) {}

  @Get(":id")
  @ApiOperation({
    summary: "Get a registration with answers, team and history",
  })
  @ApiResponse({ status: 200, description: "Registration details retrieved" })
  async getRegistration(
    @CurrentUser("id") organizerId: string,
    @Param("id", ParseIntPipe) registrationId: number,
  ) {
    return {
      message: "Registration details retrieved",
      data: await this.service.getRegistration(
        Number(organizerId),
        registrationId,
      ),
    };
  }
}
