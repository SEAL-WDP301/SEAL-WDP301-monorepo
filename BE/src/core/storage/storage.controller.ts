import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../../modules/auth/guards/jwt-auth.guard";
import { StorageService } from "./storage.service";

@ApiTags("Storage")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("storage")
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post("upload")
  @ApiOperation({
    summary: "Upload a file to cloud storage (e.g., Cover Image)",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor("file"))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("No file provided");
    }
    try {
      const result = await this.storageService.uploadFile(file, "general");
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message || "Failed to upload file");
    }
  }
}
