import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional } from "class-validator";

export class RevealTracksDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  forceReassign?: boolean;

  @ApiPropertyOptional({
    description: "Round whose tracks are used for assignment (Flow B ceremony)",
  })
  @IsOptional()
  @IsInt()
  roundId?: number;

  @ApiPropertyOptional({
    description:
      "When true, open student self-draw (leaders click Sắp xếp on workspace). When false, bulk lottery on projector.",
  })
  @IsOptional()
  @IsBoolean()
  studentSelfDraw?: boolean;
}
