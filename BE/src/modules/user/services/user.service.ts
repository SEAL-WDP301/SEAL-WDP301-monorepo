import {
  Injectable,
  NotFoundException,
  ConflictException,
  OnApplicationBootstrap,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { User, Role } from "@prisma/client";
import { Provider } from "../../../common/enums/provider.enum";
import { hashPassword } from "../../../common/utils/hash.util";
import { MESSAGES } from "../../../common/constants/messages.constant";
import { UpsertStudentProfileDto } from "../dto/upsert-student-profile.dto";
import { UpsertStakeholderProfileDto } from "../dto/upsert-stakeholder-profile.dto";
import { OrganizerUpdateUserDto } from "../dto/organizer-update-user.dto";
import { UpdateUserDto } from "../dto/update-user.dto";


/**
 * CreateUserData — internal type for creating users from different sources.
 */
export interface CreateUserData {
  email: string;
  fullName: string;
  password: string | null;
  provider: Provider;
  googleId?: string;
  githubId?: string;
  role?: Role;
  code?: string;
  phone?: string;
  avatarUrl?: string;
  isActive?: boolean;
}

/**
 * UserService — data access layer for User.
 *
 * All database operations for users go through this service.
 */
@Injectable()
export class UserService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Auto-seed a default Admin user if the database is empty.
   * Runs automatically on NestJS application bootstrap.
   */
  async onApplicationBootstrap(): Promise<void> {
    // Seed default Admin User
    const adminEmail = "admin@admin.com";
    const adminExists = await this.prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!adminExists) {
      this.logger.log(
        "Default Admin user not found. Seeding default Admin user...",
      );

      const plainPassword = "admin123";
      const hashedPassword = await hashPassword(plainPassword);

      await this.prisma.user.create({
        data: {
          email: adminEmail,
          name: "System Admin",
          passwordHash: hashedPassword,
          role: Role.admin,
        },
      });

      this.logger.log(`Default Admin user seeded successfully!`);
      this.logger.log(
        `Credentials -> Email: ${adminEmail} | Password: ${plainPassword}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // READ operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Find user by ID. Returns null if not found.
   */
  async findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Find user by ID including hashedRefreshToken.
   */
  async findByIdWithRefreshToken(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Find user by email. Returns null if not found.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Find user by email WITH password field included.
   * In Prisma, passwordHash is returned by default unless excluded.
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Find user by Google ID.
   */
  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { googleId } });
  }

  /**
   * Find user by GitHub ID.
   */
  async findByGithubId(githubId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { githubId } });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // WRITE operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a new user record.
   */
  async createUser(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.fullName,
        passwordHash: data.password,
        googleId: data.googleId,
        githubId: data.githubId,
        role: data.role ?? Role.student,
        avatarUrl: data.avatarUrl,
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * Update a user's refresh token.
   */
  async updateRefreshToken(
    id: number,
    refreshToken: string | null,
  ): Promise<void> {
    const hashedToken = refreshToken ? await hashPassword(refreshToken) : null;
    await this.prisma.user.update({
      where: { id },
      data: { hashedRefreshToken: hashedToken },
    });
  }

  /**
   * Get user profile by ID. Throws NotFoundException if not found.
   */
  async getProfile(id: number): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        studentProfile: true,
        stakeholderProfile: true,
      },
    });
    if (!user) {
      throw new NotFoundException(MESSAGES.USER_NOT_FOUND);
    }
    return user;
  }



  /**
   * Update the authenticated student's profile.
   */
  async updateStudentProfile(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(MESSAGES.USER_NOT_FOUND);
    }

    const existingProfile = await this.prisma.studentProfile.findUnique({
      where: { userId: id },
    });

    const studentProfileData = {
      studentType: dto.studentType,
      studentCode: dto.studentCode,
      universityName: dto.universityName,
      phone: dto.phone,
      githubUsername: dto.githubUsername,
    };
    const hasStudentProfileData = Object.values(studentProfileData).some(
      (value) => value !== undefined,
    );

    if (
      !existingProfile &&
      hasStudentProfileData &&
      (!dto.studentType || !dto.studentCode)
    ) {
      throw new BadRequestException("studentType and studentCode are required");
    }

    return this.prisma.$transaction(async (tx) => {
      if (hasStudentProfileData) {
        if (existingProfile) {
          await tx.studentProfile.update({
            where: { userId: id },
            data: studentProfileData,
          });
        } else {
          await tx.studentProfile.create({
            data: {
              userId: id,
              studentType: dto.studentType!,
              studentCode: dto.studentCode!,
              universityName: dto.universityName,
              phone: dto.phone,
              githubUsername: dto.githubUsername,
            },
          });
        }
      }

      if (dto.fullName) {
        return tx.user.update({
          where: { id },
          data: {
            name: dto.fullName,
            avatarUrl: dto.avatarUrl,
          },
          include: { studentProfile: true },
        });
      }

      if (dto.avatarUrl) {
        return tx.user.update({
          where: { id },
          data: { avatarUrl: dto.avatarUrl },
          include: { studentProfile: true },
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id },
        include: { studentProfile: true },
      });
    });
  }

  /**
   * Update a user's active status.
   */
  async updateIsActive(id: number, isActive: boolean): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
  }

  /**
   * Update a user's Google info if they logged in with Google after local registration.
   */
  async updateGoogleAuthInfo(
    id: number,
    data: { googleId: string; avatarUrl: string; isActive: boolean },
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        googleId: data.googleId,
        avatarUrl: data.avatarUrl,
        isActive: data.isActive,
      },
    });
  }

  /**
   * Update a user's GitHub info if they logged in with GitHub after another registration method.
   */
  async updateGithubAuthInfo(
    id: number,
    data: { githubId: string; avatarUrl?: string; isActive: boolean },
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        githubId: data.githubId,
        avatarUrl: data.avatarUrl,
        isActive: data.isActive,
      },
    });
  }

  /**
   * Update user's password.
   */
  async updatePassword(id: number, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PROFILE \u0026 ORGANIZER CRUD operations
  // ─────────────────────────────────────────────────────────────────────────────

  async upsertStudentProfile(userId: number, data: UpsertStudentProfileDto) {
    const existingStakeholder = await this.prisma.stakeholderProfile.findUnique(
      { where: { userId } },
    );
    if (existingStakeholder) {
      throw new ConflictException(
        "User already has a stakeholder profile. Cannot be both.",
      );
    }

    const profile = await this.prisma.studentProfile.upsert({
      where: { userId },
      update: {
        studentType: data.studentType,
        studentCode: data.studentCode,
        universityName: data.universityName,
        phone: data.phone,
        githubUsername: data.githubUsername,
      },
      create: {
        userId,
        studentType: data.studentType,
        studentCode: data.studentCode,
        universityName: data.universityName,
        phone: data.phone,
        githubUsername: data.githubUsername,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { role: Role.student },
    });

    return profile;
  }

  async upsertStakeholderProfile(
    userId: number,
    data: UpsertStakeholderProfileDto,
  ) {
    const existingStudent = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });
    if (existingStudent) {
      throw new ConflictException(
        "User already has a student profile. Cannot be both.",
      );
    }

    const profile = await this.prisma.stakeholderProfile.upsert({
      where: { userId },
      update: {
        jobTitle: data.jobTitle,
        organization: data.organization,
        experience: data.experience,
        achievements: data.achievements,
        bio: data.bio,
        isPublic: data.isPublic,
      },
      create: {
        userId,
        jobTitle: data.jobTitle,
        organization: data.organization,
        experience: data.experience,
        achievements: data.achievements,
        bio: data.bio,
        isPublic: data.isPublic ?? true,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { role: Role.stakeholder },
    });

    return profile;
  }

  async findAllUsers() {
    return this.prisma.user.findMany({
      include: {
        studentProfile: true,
        stakeholderProfile: true,
      },
    });
  }

  async updateUserBaseInfo(
    id: number,
    data: OrganizerUpdateUserDto,
  ): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(MESSAGES.USER_NOT_FOUND);
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        role: data.role,
        isActive: data.isActive,
      },
    });
  }

  async softDeleteUser(id: number): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(MESSAGES.USER_NOT_FOUND);
    }
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getUserHistory(userId: number) {
    const hackerHistory = await this.prisma.team.findMany({
      where: {
        OR: [
          { leaderId: userId },
          { members: { some: { userId, status: "accepted" } } },
        ],
      },
      include: {
        event: true,
        track: true,
        award: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const judgeHistory = await this.prisma.judgeAssignment.findMany({
      where: { judgeId: userId },
      include: {
        round: { include: { event: true } },
        track: true,
      },
      orderBy: { assignedAt: "desc" },
    });

    const mentorHistory = await this.prisma.mentorAssignment.findMany({
      where: { mentorId: userId },
      include: {
        team: {
          include: {
            event: true,
            track: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    return {
      hackerHistory,
      judgeHistory,
      mentorHistory,
    };
  }
}
