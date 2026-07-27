import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Role, Season, EventStatus, SubmissionType } from "@prisma/client";
import * as bcrypt from "bcrypt";

@Injectable()
export class SeedService {
  constructor(private readonly prisma: PrismaService) {}

  async run() {
    console.log("--- Starting Database Seeding ---");
    const adminEmail = "admin@gmail.com";
    let adminUser = await this.prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!adminUser) {
      const hashedPassword = await bcrypt.hash("12345678", 10);

      adminUser = await this.prisma.user.create({
        data: {
          email: adminEmail,
          name: "System Administrator",
          passwordHash: hashedPassword,
          role: Role.admin,
        },
      });
      console.log(
        `[User] Default admin user created: ${adminEmail} (password: Admin@123)`,
      );
    } else {
      console.log(`[User] Default admin user already exists: ${adminEmail}`);
    }

    await this.seedEvents(adminUser.id);

    console.log("--- Database Seeding Completed ---");
  }

  private async seedEvents(adminId: number) {
    // Legacy events seeding logic removed as requested.
  }
}
