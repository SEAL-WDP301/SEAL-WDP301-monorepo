import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { E2eTesterService } from './e2e-tester.service';

export class RunE2eScriptDto {
  @ApiProperty({ description: 'Key of the E2E script to execute', example: '02-create-teams' })
  @IsString()
  @IsNotEmpty()
  scriptKey: string;

  @ApiPropertyOptional({ description: 'ID of the target event', example: 46 })
  @IsOptional()
  @IsNumber()
  eventId?: number;
}

@ApiTags('Dev/E2E Tester')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('dev-e2e')
export class E2eTesterController {
  constructor(private readonly e2eTesterService: E2eTesterService) {}

  @Post('run-script')
  @ApiOperation({ summary: 'Run an E2E test script (Admin only)' })
  async runScript(@Body() dto: RunE2eScriptDto) {
    return this.e2eTesterService.runScript(dto.scriptKey, dto.eventId);
  }
}
