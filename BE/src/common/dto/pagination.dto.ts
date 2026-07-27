import { IsOptional, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { APP_CONSTANTS } from "../constants/app.constant";

/**
 * Common pagination DTO — extend in module-specific list DTOs.
 */
export class PaginationDto {
  /**
   * Page number (1-based)
   * @default 1
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = APP_CONSTANTS.DEFAULT_PAGE;

  /**
   * Items per page
   * @default 10
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(APP_CONSTANTS.MAX_LIMIT)
  limit?: number = APP_CONSTANTS.DEFAULT_LIMIT;
}
