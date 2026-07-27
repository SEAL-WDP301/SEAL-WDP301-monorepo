import {
  Controller,
  Get,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { UserService } from "../services/user.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { MESSAGES } from "../../../common/constants/messages.constant";
import { UpsertStudentProfileDto } from "../dto/upsert-student-profile.dto";
import { UpsertStakeholderProfileDto } from "../dto/upsert-stakeholder-profile.dto";
import { OrganizerUpdateUserDto } from "../dto/organizer-update-user.dto";
import { Roles } from "../../../common/decorators/roles.decorator";
import { Role } from "../../../common/enums/role.enum";
import { RolesGuard } from "../../../common/guards/roles.guard";

@ApiTags("Users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get("profile")
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({ status: 200, description: "Profile retrieved successfully" })
  @ApiResponse({
    status: 401,
    description: "Unauthorized — missing or invalid token",
  })
  async getProfile(@CurrentUser("id") userId: string) {
    const user = await this.userService.getProfile(Number(userId));
    return {
      message: MESSAGES.PROFILE_FETCHED,
      data: user,
    };
  }

  @Get("profile-history")
  @ApiOperation({
    summary: "Get current user hackathon history and achievements",
  })
  @ApiResponse({ status: 200, description: "History retrieved successfully" })
  async getProfileHistory(@CurrentUser("id") userId: string) {
    const history = await this.userService.getUserHistory(Number(userId));
    return {
      message: "User history retrieved successfully",
      data: history,
    };
  }



  @Put("profile/student")
  @ApiOperation({ summary: "Update own student profile" })
  async updateOwnStudentProfile(
    @CurrentUser("id") userId: string,
    @Body() data: UpsertStudentProfileDto,
  ) {
    const profile = await this.userService.upsertStudentProfile(
      Number(userId),
      data,
    );
    return { message: "Student profile updated successfully", data: profile };
  }

  @Put("profile/stakeholder")
  @ApiOperation({ summary: "Update own stakeholder profile" })
  async updateOwnStakeholderProfile(
    @CurrentUser("id") userId: string,
    @Body() data: UpsertStakeholderProfileDto,
  ) {
    const profile = await this.userService.upsertStakeholderProfile(
      Number(userId),
      data,
    );
    return {
      message: "Stakeholder profile updated successfully",
      data: profile,
    };
  }

  @Get()
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Get all users (Organizer/Admin only)" })
  async getAllUsers() {
    const users = await this.userService.findAllUsers();
    return { message: "Users retrieved successfully", data: users };
  }

  @Get(":id/profile")
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: "Get a specific user profile (Organizer/Admin only)",
  })
  async getUserProfileById(@Param("id", ParseIntPipe) id: number) {
    const user = await this.userService.getProfile(id);
    return { message: "User profile retrieved successfully", data: user };
  }

  @Put(":id/profile/student")
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: "Update any user student profile (Organizer/Admin only)",
  })
  async updateStudentProfile(
    @Param("id", ParseIntPipe) id: number,
    @Body() data: UpsertStudentProfileDto,
  ) {
    const profile = await this.userService.upsertStudentProfile(id, data);
    return { message: "Student profile updated successfully", data: profile };
  }

  @Put(":id/profile/stakeholder")
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: "Update any user stakeholder profile (Organizer/Admin only)",
  })
  async updateStakeholderProfile(
    @Param("id", ParseIntPipe) id: number,
    @Body() data: UpsertStakeholderProfileDto,
  ) {
    const profile = await this.userService.upsertStakeholderProfile(id, data);
    return {
      message: "Stakeholder profile updated successfully",
      data: profile,
    };
  }

  @Patch(":id")
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Update user base info (Organizer/Admin only)" })
  async updateUserBaseInfo(
    @Param("id", ParseIntPipe) id: number,
    @Body() data: OrganizerUpdateUserDto,
  ) {
    const user = await this.userService.updateUserBaseInfo(id, data);
    return { message: "User base info updated successfully", data: user };
  }

  @Delete(":id")
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: "Soft delete user (Organizer/Admin only)" })
  async deleteUser(@Param("id", ParseIntPipe) id: number) {
    await this.userService.softDeleteUser(id);
    return { message: "User soft deleted successfully" };
  }
}
