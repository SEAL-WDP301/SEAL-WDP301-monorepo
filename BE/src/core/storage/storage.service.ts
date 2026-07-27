import { Injectable, Logger } from "@nestjs/common";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly endpoint: string;
  private readonly logger = new Logger(StorageService.name);

  constructor() {
    this.endpoint = process.env.DO_SPACES_ENDPOINT || "";
    this.bucketName = process.env.DO_SPACES_BUCKET_NAME || "";

    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: process.env.DO_SPACES_REGION || "sgp1",
      credentials: {
        accessKeyId: process.env.DO_SPACES_KEY || "",
        secretAccessKey: process.env.DO_SPACES_SECRET || "",
      },
    });
  }

  /**
   * Uploads a file to DigitalOcean Spaces
   * @param file The file from multer
   * @param folder The folder path (e.g. 'submissions/event-1/')
   * @returns fileUrl and fileKey
   */
  async uploadFile(file: Express.Multer.File, folder: string = "uploads") {
    try {
      const fileExt = file.originalname.split(".").pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const fileKey = `${folder}/${fileName}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: "public-read", // Ensure the file is publicly accessible
      });

      await this.s3Client.send(command);

      // DigitalOcean Space public URL format: https://<bucket>.sgp1.digitaloceanspaces.com/<key>
      const endpointDomain = this.endpoint.replace("https://", "");
      const fileUrl = `https://${this.bucketName}.${endpointDomain}/${fileKey}`;

      return { fileUrl, fileKey };
    } catch (error) {
      this.logger.error(`Error uploading file to Spaces: ${error.message}`);
      throw new Error("Failed to upload file");
    }
  }

  /**
   * Deletes a file from DigitalOcean Spaces
   * @param fileKey The key of the file to delete
   */
  async deleteFile(fileKey: string) {
    if (!fileKey) return;

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      await this.s3Client.send(command);
      this.logger.log(`Deleted file: ${fileKey}`);
    } catch (error) {
      this.logger.error(`Error deleting file from Spaces: ${error.message}`);
      // We don't throw an error here because deleting old file is a secondary action,
      // we don't want to break the main flow if cleanup fails.
    }
  }
}
