import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AdminRealtimeGateway } from '../../event/gateways/admin-realtime.gateway';
import { GithubService } from '../../../core/github/github.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class GithubWebhookService {
  private readonly logger = new Logger(GithubWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminGateway: AdminRealtimeGateway,
    private readonly githubService: GithubService,
    @InjectQueue('github-repo') private readonly githubQueue: Queue,
  ) {}

  async getTeamCommits(teamId: number) {
    return this.prisma.githubCommit.findMany({
      where: { teamId },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });
  }

  async getEventCommits(eventId: number) {
    return this.prisma.githubCommit.findMany({
      where: { team: { eventId } },
      include: { team: { select: { name: true } } },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }

  async freezeRepo(teamId: number) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        event: true,
        members: {
          include: { user: { include: { studentProfile: true } } }
        },
        leader: { include: { studentProfile: true } },
      }
    });

    if (!team) throw new NotFoundException('Team not found');
    if (!team.githubRepoUrl || !team.githubRepoName) {
      throw new NotFoundException('Team repository not found');
    }

    const org = this.githubService.resolveOrgName(team.event.githubOrgUrl);
    if (!org) throw new NotFoundException('GitHub Organization is not configured');

    // Remove write access by setting permission to 'pull' (read-only) for all members
    const allUsers = [...team.members.map(m => m.user), team.leader];
    
    const freezePromises = allUsers.map(async (user) => {
      const githubUsername = user?.studentProfile?.githubUsername;
      if (githubUsername) {
        try {
          await this.githubService.addCollaborator(org, team.githubRepoName!, githubUsername, 'pull');
        } catch (error: any) {
          this.logger.error(`Failed to freeze repo for user ${githubUsername}: ${error.message}`);
        }
      }
    });

    await Promise.all(freezePromises);
    
    await this.prisma.team.update({
      where: { id: team.id },
      data: { isFrozen: true } as any
    });
    
    return { success: true, message: `Repository ${team.githubRepoName} is now frozen (Read-only)` };
  }

  async freezeEventRepos(eventId: number) {
    const teams = await this.prisma.team.findMany({
      where: { 
        eventId: eventId,
        githubRepoUrl: { not: null },
        githubRepoName: { not: null }
      },
      include: {
        event: true,
        members: { include: { user: { include: { studentProfile: true } } } },
        leader: { include: { studentProfile: true } },
      }
    });

    if (teams.length === 0) {
      return { success: true, message: 'No repositories to freeze' };
    }

    const org = this.githubService.resolveOrgName(teams[0].event.githubOrgUrl);
    if (!org) throw new NotFoundException('GitHub Organization is not configured');

    const freezePromises = [];

    for (const team of teams) {
      const memberUsers = team.members.map(m => m.user).filter(u => u.id !== team.leaderId);
      const allUsers = [team.leader, ...memberUsers];
      
      for (const user of allUsers) {
        const githubUsername = user?.studentProfile?.githubUsername;
        if (githubUsername) {
          freezePromises.push(
            this.githubQueue.add(
              "set-permission",
              { org, repoName: team.githubRepoName!, username: githubUsername, permission: "pull", eventId },
              { attempts: 5, backoff: { type: "exponential", delay: 2000 } }
            )
          );
        }
      }
    }

    await Promise.all(freezePromises);

    await this.prisma.round.updateMany({
      where: { eventId },
      data: { isRepoFrozen: true } as any
    });
    
    return { success: true, message: `Successfully queued freeze jobs for ${teams.length} repositories` };
  }

  async unfreezeEventRepos(eventId: number) {
    const teams = await this.prisma.team.findMany({
      where: { 
        eventId: eventId,
        githubRepoUrl: { not: null },
        githubRepoName: { not: null }
      },
      include: {
        event: true,
        members: { include: { user: { include: { studentProfile: true } } } },
        leader: { include: { studentProfile: true } },
      }
    });

    if (teams.length === 0) {
      return { success: true, message: 'No repositories to unfreeze' };
    }

    const org = this.githubService.resolveOrgName(teams[0].event.githubOrgUrl);
    if (!org) throw new NotFoundException('GitHub Organization is not configured');

    const unfreezePromises = [];

    for (const team of teams) {
      const memberUsers = team.members.map(m => m.user).filter(u => u.id !== team.leaderId);
      const allUsers = [team.leader, ...memberUsers];
      
      for (const user of allUsers) {
        const githubUsername = user?.studentProfile?.githubUsername;
        if (githubUsername) {
          unfreezePromises.push(
            this.githubQueue.add(
              "set-permission",
              { org, repoName: team.githubRepoName!, username: githubUsername, permission: "push", eventId },
              { attempts: 5, backoff: { type: "exponential", delay: 2000 } }
            )
          );
        }
      }
    }

    await Promise.all(unfreezePromises);

    await this.prisma.round.updateMany({
      where: { eventId },
      data: { isRepoFrozen: false } as any
    });

    return { success: true, message: `Successfully queued unfreeze jobs for ${teams.length} repositories` };
  }

  async getTeamCollaboratorStatus(teamId: number) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        event: true,
        members: { include: { user: { include: { studentProfile: true } } } },
        leader: { include: { studentProfile: true } },
      },
    });

    if (!team) throw new NotFoundException('Team not found');
    if (!team.githubRepoUrl || !team.githubRepoName) {
      throw new NotFoundException('Team repository not found');
    }

    const org = this.githubService.resolveOrgName(team.event.githubOrgUrl);
    if (!org) throw new NotFoundException('GitHub Organization is not configured');

    const [collaborators, invitations] = await Promise.all([
      this.githubService.getRepoCollaborators(org, team.githubRepoName),
      this.githubService.getRepoInvitations(org, team.githubRepoName),
    ]);

    const collaboratorLogins = new Set(collaborators.map((c: any) => c.login?.toLowerCase()));
    const invitationLogins = new Set(invitations.map((i: any) => i.invitee?.login?.toLowerCase()));

    const memberUsers = team.members.map(m => m.user).filter(u => u.id !== team.leaderId);
    const allUsers = [team.leader, ...memberUsers];
    
    return allUsers.map(user => {
      const githubUsername = user.studentProfile?.githubUsername?.toLowerCase();
      let status = 'Not Invited'; // Default

      if (githubUsername) {
        if (collaboratorLogins.has(githubUsername)) {
          status = 'Accepted';
        } else if (invitationLogins.has(githubUsername)) {
          status = 'Pending';
        } else {
          status = 'Missing';
        }
      } else {
        status = 'No GitHub Account Linked';
      }

      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        githubUsername: user.studentProfile?.githubUsername,
        status,
        isLeader: user.id === team.leaderId
      };
    });
  }

  async handlePushEvent(payload: any) {
    const repoUrl = payload.repository?.html_url;
    const commits = payload.commits;
    const pusher = payload.pusher?.name || payload.sender?.login;

    if (!commits || commits.length === 0 || !repoUrl) {
      return;
    }

    try {
      // Find the team by githubUrl (or assignedRepoUrl if that is the exact name in schema)
      // We will look for Team that has this repoUrl.
      const team = await this.prisma.team.findFirst({
        where: {
          githubRepoUrl: repoUrl,
        },
        include: {
          event: true,
        },
      });

      if (!team) {
        this.logger.warn(`No team found for repository: ${repoUrl}`);
        return;
      }

      // Get the latest commit
      const latestCommit = commits[commits.length - 1];

      const eventData = {
        teamId: team.id,
        teamName: team.name,
        repoUrl: repoUrl,
        pusher: pusher,
        message: latestCommit?.message,
        commitUrl: latestCommit?.url,
        timestamp: latestCommit?.timestamp,
        eventId: team.eventId,
      };

      // 1. Save to DB
      if (latestCommit) {
        await this.prisma.githubCommit.create({
          data: {
            teamId: team.id,
            commitHash: latestCommit.id,
            message: latestCommit.message,
            pusher: pusher,
            url: latestCommit.url,
            timestamp: new Date(latestCommit.timestamp),
          },
        });
      }

      this.logger.log(`Broadcasting new commit for team ${team.name} by ${pusher}`);

      // Broadcast to organizer room
      this.adminGateway.server.to(`admin-event-${team.eventId}`).emit('github.commit.new', eventData);
      
      // Broadcast to team room so students can see their own commits
      this.adminGateway.server.to(`team-${team.id}`).emit('github.commit.new', eventData);

    } catch (error) {
      this.logger.error(`Error processing push event: ${error.message}`, error.stack);
    }
  }

  async syncEventCommits(eventId: number) {
    const teams = await this.prisma.team.findMany({
      where: { eventId, githubRepoUrl: { not: null }, githubRepoName: { not: null } },
      include: { event: true },
    });

    if (teams.length === 0) return { success: true, message: 'No repositories found' };

    let totalSynced = 0;

    for (const team of teams) {
      const org = this.githubService.resolveOrgName(team.event.githubOrgUrl);
      if (!org || !team.githubRepoName) continue;

      const commits = await this.githubService.getRepoCommits(org, team.githubRepoName);
      
      for (const commit of commits) {
        // Upsert commit
        const hash = commit.sha;
        const existing = await this.prisma.githubCommit.findFirst({
          where: { commitHash: hash, teamId: team.id }
        });
        
        if (!existing) {
          await this.prisma.githubCommit.create({
            data: {
              teamId: team.id,
              commitHash: hash,
              message: commit.commit?.message || 'No message',
              pusher: commit.author?.login || commit.commit?.author?.name || 'Unknown',
              url: commit.html_url,
              timestamp: new Date(commit.commit?.author?.date || new Date()),
            }
          });
          totalSynced++;
        }
      }
    }

    return { success: true, message: `Synced ${totalSynced} new commits` };
  }
}
