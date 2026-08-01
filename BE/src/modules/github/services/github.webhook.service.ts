import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { TeamMemberStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { GithubService } from '../../../core/github/github.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AdminRealtimeGateway } from '../../event/gateways/admin-realtime.gateway';

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
    const commits = await this.prisma.githubCommit.findMany({
      where: { teamId },
      orderBy: { timestamp: 'desc' },
      take: 300,
    });
    return {
      commits,
      summary: this.buildCommitSummary(commits),
    };
  }

  async getEventCommits(eventId: number) {
    const commits = await this.prisma.githubCommit.findMany({
      where: { team: { eventId } },
      include: { team: { select: { id: true, name: true, githubRepoUrl: true } } },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
    return {
      commits,
      summary: this.buildCommitSummary(commits),
    };
  }

  /** Global admin dashboard: all team repos in an event (DB-first, no per-repo GitHub fan-out). */
  async getEventReposDashboard(eventId: number) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        name: true,
        githubOrgUrl: true,
        startDate: true,
        endDate: true,
      },
    });
    if (!event) throw new NotFoundException('Event not found');

    /** Hackathon window: event dates, capped ~7 days (not a 30-day SaaS chart). */
    const chartDates = this.buildHackathonDateAxis(
      event.startDate,
      event.endDate,
      7,
    );

    const teams = await this.prisma.team.findMany({
      where: { eventId },
      select: {
        id: true,
        name: true,
        leaderId: true,
        githubRepoUrl: true,
        githubRepoName: true,
        leader: { select: { id: true, name: true, email: true } },
        members: {
          where: { status: TeamMemberStatus.accepted },
          select: { userId: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const commits = await this.prisma.githubCommit.findMany({
      where: { team: { eventId } },
      select: {
        id: true,
        teamId: true,
        commitHash: true,
        message: true,
        url: true,
        timestamp: true,
        pusher: true,
        authorLogin: true,
        authorName: true,
        additions: true,
        deletions: true,
        changedFiles: true,
        files: true,
      },
      orderBy: { timestamp: 'desc' },
    });

    const byTeam = new Map<number, typeof commits>();
    for (const c of commits) {
      const list = byTeam.get(c.teamId) || [];
      list.push(c);
      byTeam.set(c.teamId, list);
    }

    const teamRows = teams.map((team) => {
      const teamCommits = byTeam.get(team.id) || [];
      const summary = this.buildCommitSummary(teamCommits);
      const fileStats = this.buildFileStatusStats(teamCommits);
      const last = teamCommits[0] || null;
      const authors = new Set(
        teamCommits.map(
          (c) => c.authorLogin || c.authorName || c.pusher || 'Unknown',
        ),
      );
      const sparkMap = new Map(chartDates.map((d) => [d, 0]));
      for (const c of teamCommits) {
        const day = new Date(c.timestamp).toISOString().slice(0, 10);
        if (sparkMap.has(day)) sparkMap.set(day, (sparkMap.get(day) || 0) + 1);
      }
      const hasRepo = Boolean(team.githubRepoUrl || team.githubRepoName);
      return {
        teamId: team.id,
        teamName: team.name,
        repoUrl: team.githubRepoUrl,
        repoName: team.githubRepoName,
        hasRepo,
        leaderName: team.leader?.name || null,
        memberCount:
          team.members.filter((m) => m.userId !== team.leaderId).length + 1,
        commitCount: summary.commitCount,
        authorCount: authors.size,
        additions: summary.additions,
        deletions: summary.deletions,
        netLines: summary.additions - summary.deletions,
        uniqueFiles: summary.uniqueFiles ?? 0,
        filesAdded: fileStats.added,
        filesModified: fileStats.modified,
        filesRemoved: fileStats.removed,
        lastCommitAt: last?.timestamp || null,
        lastCommitMessage: last?.message || null,
        lastAuthor:
          last?.authorLogin || last?.authorName || last?.pusher || null,
        hasActivity: teamCommits.length > 0,
        sparkline: chartDates.map((date) => ({
          date,
          commits: sparkMap.get(date) || 0,
        })),
      };
    });

    teamRows.sort(
      (a, b) =>
        b.commitCount - a.commitCount ||
        b.additions - a.additions ||
        a.teamName.localeCompare(b.teamName),
    );

    const eventFileStats = this.buildFileStatusStats(commits);
    const uniqueFilesEvent = new Set<string>();
    for (const c of commits) {
      if (!Array.isArray(c.files)) continue;
      for (const f of c.files as Array<{ filename?: string } | string>) {
        const name = typeof f === 'string' ? f : f?.filename;
        if (name) uniqueFilesEvent.add(name);
      }
    }

    const totals = {
      teamsTotal: teamRows.length,
      teamsWithRepo: teamRows.filter((t) => t.hasRepo).length,
      teamsWithActivity: teamRows.filter((t) => t.hasActivity).length,
      /** Repo gắn rồi nhưng chưa có commit (chưa đẩy code). */
      teamsIdle: teamRows.filter((t) => t.hasRepo && !t.hasActivity).length,
      /** Chưa gắn GitHub repo. */
      teamsNoRepo: teamRows.filter((t) => !t.hasRepo).length,
      commits: teamRows.reduce((s, t) => s + t.commitCount, 0),
      additions: teamRows.reduce((s, t) => s + t.additions, 0),
      deletions: teamRows.reduce((s, t) => s + t.deletions, 0),
      netLines: teamRows.reduce((s, t) => s + t.netLines, 0),
      uniqueFiles: uniqueFilesEvent.size,
      filesAdded: eventFileStats.added,
      filesModified: eventFileStats.modified,
      filesRemoved: eventFileStats.removed,
      authors: new Set(
        commits.map((c) => c.authorLogin || c.authorName || c.pusher || ''),
      ).size,
    };

    const topFiles = this.buildTopFiles(commits, 12);

    const commitsByTeam = teamRows.map((t) => ({
      teamId: t.teamId,
      teamName: t.teamName,
      commits: t.commitCount,
      additions: t.additions,
      deletions: t.deletions,
      netLines: t.netLines,
    }));

    const dayMap = new Map(
      chartDates.map((date) => [
        date,
        { date, commits: 0, additions: 0, deletions: 0 },
      ]),
    );
    const byHour = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      commits: 0,
      additions: 0,
      deletions: 0,
    }));
    for (const c of commits) {
      const ts = new Date(c.timestamp);
      const day = ts.toISOString().slice(0, 10);
      const row = dayMap.get(day);
      if (row) {
        row.commits += 1;
        row.additions += Number(c.additions || 0);
        row.deletions += Number(c.deletions || 0);
      }
      if (!Number.isNaN(ts.getTime())) {
        const h = ts.getUTCHours();
        byHour[h].commits += 1;
        byHour[h].additions += Number(c.additions || 0);
        byHour[h].deletions += Number(c.deletions || 0);
      }
    }
    const activityByDay = chartDates.map(
      (date) => dayMap.get(date) || { date, commits: 0, additions: 0, deletions: 0 },
    );

    let runningNet = 0;
    const netLinesByDay = activityByDay.map((d) => {
      runningNet += d.additions - d.deletions;
      return {
        date: d.date,
        net: d.additions - d.deletions,
        cumulativeNet: runningNet,
        additions: d.additions,
        deletions: d.deletions,
      };
    });

    // Top 5 teams race chart over hackathon days
    const topTeamIds = teamRows.filter((t) => t.hasActivity).slice(0, 5);
    const teamRace = topTeamIds.map((t) => {
      const seriesMap = new Map(chartDates.map((d) => [d, 0]));
      for (const c of byTeam.get(t.teamId) || []) {
        const day = new Date(c.timestamp).toISOString().slice(0, 10);
        if (seriesMap.has(day)) {
          seriesMap.set(day, (seriesMap.get(day) || 0) + 1);
        }
      }
      return {
        teamId: t.teamId,
        teamName: t.teamName,
        points: chartDates.map((date) => ({
          date,
          commits: seriesMap.get(date) || 0,
        })),
      };
    });

    return {
      eventId: event.id,
      eventName: event.name,
      githubOrgUrl: event.githubOrgUrl,
      tokenConfigured: this.githubService.isConfigured(),
      chartWindow: {
        dates: chartDates,
        dayCount: chartDates.length,
        startDate: chartDates[0] || null,
        endDate: chartDates[chartDates.length - 1] || null,
      },
      totals,
      teams: teamRows,
      commitsByTeam,
      topFiles,
      activityByDay,
      netLinesByDay,
      activityByHour: byHour,
      teamRace,
      recentCommits: commits.slice(0, 40).map((c) => {
        const team = teams.find((t) => t.id === c.teamId);
        return {
          ...c,
          team: team
            ? { id: team.id, name: team.name, githubRepoUrl: team.githubRepoUrl }
            : null,
        };
      }),
    };
  }

  async getTeamRepoInsights(teamId: number) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        event: true,
        leader: {
          select: {
            id: true,
            name: true,
            email: true,
            studentProfile: { select: { githubUsername: true } },
          },
        },
        members: {
          where: { status: TeamMemberStatus.accepted },
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                studentProfile: { select: { githubUsername: true } },
              },
            },
          },
        },
      },
    });
    if (!team) throw new NotFoundException('Team not found');
    if (!team.githubRepoUrl || !team.githubRepoName) {
      throw new NotFoundException('Team repository not found');
    }

    const org = this.githubService.resolveOrgName(team.event.githubOrgUrl);
    if (!org) throw new NotFoundException('GitHub Organization is not configured');

    const [insights, commitBundle, activity, collaboratorStatus] =
      await Promise.all([
        this.githubService.getRepoInsights(org, team.githubRepoName),
        this.getTeamCommits(teamId),
        this.githubService.getRepoActivityExtras(org, team.githubRepoName),
        this.getTeamCollaboratorStatus(teamId).catch(() => []),
      ]);

    const members = [
      {
        id: team.leader.id,
        name: team.leader.name,
        email: team.leader.email,
        role: 'leader' as const,
        githubUsername: team.leader.studentProfile?.githubUsername || null,
      },
      ...team.members
        .filter((m) => m.user.id !== team.leaderId)
        .map((m) => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          role: 'member' as const,
          githubUsername: m.user.studentProfile?.githubUsername || null,
        })),
    ];

    const analytics = this.buildCommitAnalytics(commitBundle.commits);
    const languageBars = this.buildLanguageBars(insights?.languages || {});
    const authorMemberMap = this.buildAuthorMemberMap(
      commitBundle.commits,
      members,
    );

    return {
      teamId: team.id,
      teamName: team.name,
      repoUrl: team.githubRepoUrl,
      repoName: team.githubRepoName,
      eventId: team.eventId,
      eventName: team.event.name,
      members,
      collaboratorStatus,
      authorMemberMap,
      insights,
      activity,
      commitSummary: commitBundle.summary,
      analytics,
      languageBars,
      commits: commitBundle.commits,
      recentCommits: commitBundle.commits.slice(0, 20),
    };
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
    const commits = Array.isArray(payload.commits) ? payload.commits : [];
    const pusher = payload.pusher?.name || payload.sender?.login || 'Unknown';
    const owner =
      payload.repository?.owner?.login ||
      payload.repository?.owner?.name ||
      null;
    const repoName = payload.repository?.name || null;

    if (commits.length === 0 || !repoUrl) {
      return;
    }

    try {
      const team = await this.prisma.team.findFirst({
        where: { githubRepoUrl: repoUrl },
        include: { event: true },
      });

      if (!team) {
        this.logger.warn(`No team found for repository: ${repoUrl}`);
        return;
      }

      const org =
        owner ||
        this.githubService.resolveOrgName(team.event.githubOrgUrl) ||
        team.githubRepoName?.split('/')[0];
      const repo = repoName || team.githubRepoName;

      const saved: any[] = [];
      for (const commit of commits.slice(-30)) {
        const row = await this.upsertCommitFromPush({
          teamId: team.id,
          commit,
          pusher,
          owner: org,
          repo,
        });
        if (row) saved.push(row);
      }

      const latest = saved[saved.length - 1] || null;
      const eventData = {
        teamId: team.id,
        teamName: team.name,
        repoUrl,
        pusher,
        message: latest?.message,
        commitHash: latest?.commitHash,
        commitUrl: latest?.url,
        timestamp: latest?.timestamp,
        eventId: team.eventId,
        additions: latest?.additions ?? null,
        deletions: latest?.deletions ?? null,
        changedFiles: latest?.changedFiles ?? null,
        files: latest?.files ?? null,
        authorLogin: latest?.authorLogin ?? null,
      };

      this.logger.log(
        `Saved ${saved.length} commit(s) for team ${team.name} by ${pusher}`,
      );

      this.adminGateway.server
        .to(`admin-event-${team.eventId}`)
        .emit('github.commit.new', eventData);
      this.adminGateway.server
        .to(`team-${team.id}`)
        .emit('github.commit.new', eventData);
    } catch (error: any) {
      this.logger.error(
        `Error processing push event: ${error.message}`,
        error.stack,
      );
    }
  }

  async syncTeamCommits(teamId: number) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { event: true },
    });

    if (!team?.githubRepoName || !team.githubRepoUrl) {
      throw new NotFoundException('Team repository not found');
    }

    const org = this.githubService.resolveOrgName(team.event.githubOrgUrl);
    if (!org) {
      throw new BadRequestException(
        'Cannot resolve GitHub org for this team event',
      );
    }

    const commits = await this.githubService.getRepoCommitsPaged(
      org,
      team.githubRepoName,
      3,
    );

    let totalSynced = 0;
    let totalEnriched = 0;

    for (const commit of commits) {
      const result = await this.upsertCommitFromApiList({
        teamId: team.id,
        owner: org,
        repo: team.githubRepoName,
        commit,
        enrich: true,
      });
      if (result.created) totalSynced++;
      if (result.enriched) totalEnriched++;
    }

    return {
      success: true,
      teamId: team.id,
      teamName: team.name,
      fetched: commits.length,
      synced: totalSynced,
      enriched: totalEnriched,
      message: `Team "${team.name}": synced ${totalSynced} new, enriched ${totalEnriched}/${commits.length} commits (GitHub quota saved — 1 team only)`,
    };
  }

  async syncEventCommits(eventId: number) {
    const teams = await this.prisma.team.findMany({
      where: {
        eventId,
        githubRepoUrl: { not: null },
        githubRepoName: { not: null },
      },
      select: { id: true },
    });

    if (teams.length === 0) {
      return { success: true, message: 'No repositories found' };
    }

    let totalSynced = 0;
    let totalEnriched = 0;

    for (const team of teams) {
      const result = await this.syncTeamCommits(team.id);
      totalSynced += result.synced;
      totalEnriched += result.enriched;
    }

    return {
      success: true,
      message: `Synced ${totalSynced} new commits across ${teams.length} teams, enriched ${totalEnriched} with file/stat details`,
    };
  }

  /**
   * Build continuous UTC date axis for a short hackathon.
   * Prefers event start→end; if missing/long, fall back to last `maxDays` days.
   */
  private buildHackathonDateAxis(
    startDate?: Date | null,
    endDate?: Date | null,
    maxDays = 7,
  ): string[] {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let end = endDate ? new Date(endDate) : new Date(today);
    end.setUTCHours(0, 0, 0, 0);
    if (end.getTime() > today.getTime()) end = new Date(today);

    let start = startDate ? new Date(startDate) : null;
    if (start) start.setUTCHours(0, 0, 0, 0);

    if (!start || Number.isNaN(start.getTime())) {
      start = new Date(end);
      start.setUTCDate(start.getUTCDate() - (maxDays - 1));
    }

    if (start.getTime() > end.getTime()) {
      start = new Date(end);
      start.setUTCDate(start.getUTCDate() - (maxDays - 1));
    }

    const spanDays =
      Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (spanDays > maxDays) {
      start = new Date(end);
      start.setUTCDate(start.getUTCDate() - (maxDays - 1));
    }

    const dates: string[] = [];
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates.length ? dates : [today.toISOString().slice(0, 10)];
  }

  private buildLanguageBars(languages: Record<string, number>) {
    const total = Object.values(languages).reduce((a, b) => a + Number(b || 0), 0);
    if (!total) return [];
    return Object.entries(languages)
      .map(([name, bytes]) => ({
        name,
        bytes: Number(bytes || 0),
        percent: Math.round((Number(bytes || 0) / total) * 1000) / 10,
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8);
  }

  private buildAuthorMemberMap(
    commits: Array<{
      authorLogin?: string | null;
      authorName?: string | null;
      pusher?: string;
      additions?: number | null;
      deletions?: number | null;
    }>,
    members: Array<{
      id: number;
      name: string;
      email: string;
      githubUsername?: string | null;
      role: string;
    }>,
  ) {
    const byLogin = new Map(
      members
        .filter((m) => m.githubUsername)
        .map((m) => [m.githubUsername!.toLowerCase(), m]),
    );

    const authorStats = new Map<
      string,
      { author: string; commits: number; additions: number; deletions: number }
    >();

    for (const c of commits) {
      const author = c.authorLogin || c.authorName || c.pusher || 'Unknown';
      const key = author.toLowerCase();
      const row = authorStats.get(key) || {
        author,
        commits: 0,
        additions: 0,
        deletions: 0,
      };
      row.commits += 1;
      row.additions += Number(c.additions || 0);
      row.deletions += Number(c.deletions || 0);
      authorStats.set(key, row);
    }

    const matched = [...authorStats.values()].map((a) => {
      const member = byLogin.get(a.author.toLowerCase()) || null;
      return {
        ...a,
        matchedMember: member
          ? {
              id: member.id,
              name: member.name,
              email: member.email,
              role: member.role,
              githubUsername: member.githubUsername,
            }
          : null,
      };
    });

    const unmatchedMembers = members.filter((m) => {
      if (!m.githubUsername) return true;
      return !authorStats.has(m.githubUsername.toLowerCase());
    });

    return { authors: matched, unmatchedMembers };
  }

  private buildCommitAnalytics(
    commits: Array<{
      timestamp: Date;
      pusher: string;
      additions?: number | null;
      deletions?: number | null;
      changedFiles?: number | null;
      authorLogin?: string | null;
      authorName?: string | null;
      files?: unknown;
      message?: string;
    }>,
  ) {
    const byDay = new Map<
      string,
      { date: string; commits: number; additions: number; deletions: number }
    >();
    const byAuthor = new Map<
      string,
      { author: string; commits: number; additions: number; deletions: number }
    >();
    const fileHits = new Map<
      string,
      {
        filename: string;
        touches: number;
        additions: number;
        deletions: number;
        statuses: Record<string, number>;
      }
    >();
    const byHour = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      commits: 0,
      additions: 0,
      deletions: 0,
    }));

    const sorted = [...commits].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    for (const c of sorted) {
      const d = new Date(c.timestamp);
      const day = Number.isNaN(d.getTime())
        ? 'unknown'
        : d.toISOString().slice(0, 10);
      const author = c.authorLogin || c.authorName || c.pusher || 'Unknown';
      const add = Number(c.additions || 0);
      const del = Number(c.deletions || 0);

      if (!Number.isNaN(d.getTime())) {
        const hour = d.getUTCHours();
        byHour[hour].commits += 1;
        byHour[hour].additions += add;
        byHour[hour].deletions += del;
      }

      const dayRow = byDay.get(day) || {
        date: day,
        commits: 0,
        additions: 0,
        deletions: 0,
      };
      dayRow.commits += 1;
      dayRow.additions += add;
      dayRow.deletions += del;
      byDay.set(day, dayRow);

      const authorRow = byAuthor.get(author) || {
        author,
        commits: 0,
        additions: 0,
        deletions: 0,
      };
      authorRow.commits += 1;
      authorRow.additions += add;
      authorRow.deletions += del;
      byAuthor.set(author, authorRow);

      if (Array.isArray(c.files)) {
        for (const f of c.files as Array<{
          filename?: string;
          additions?: number;
          deletions?: number;
          status?: string;
        } | string>) {
          const filename = typeof f === 'string' ? f : f?.filename;
          if (!filename) continue;
          const hit = fileHits.get(filename) || {
            filename,
            touches: 0,
            additions: 0,
            deletions: 0,
            statuses: {},
          };
          hit.touches += 1;
          if (typeof f !== 'string') {
            hit.additions += Number(f.additions || 0);
            hit.deletions += Number(f.deletions || 0);
            const st = String(f.status || 'modified');
            hit.statuses[st] = (hit.statuses[st] || 0) + 1;
          }
          fileHits.set(filename, hit);
        }
      }
    }

    // Hackathon-scale window (not a 30-day product analytics chart)
    const commitsByDay = [...byDay.values()].slice(-7);
    const maxDayCommits = Math.max(1, ...commitsByDay.map((x) => x.commits));
    const commitsByAuthor = [...byAuthor.values()]
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 12);
    const topFiles = [...fileHits.values()]
      .sort((a, b) => b.touches - a.touches || b.additions - a.additions)
      .slice(0, 15)
      .map((f) => ({
        filename: f.filename,
        touches: f.touches,
        additions: f.additions,
        deletions: f.deletions,
        primaryStatus:
          Object.entries(f.statuses).sort((a, b) => b[1] - a[1])[0]?.[0] ||
          'modified',
      }));

    let runningNet = 0;
    const netLinesByDay = commitsByDay.map((x) => {
      runningNet += x.additions - x.deletions;
      return {
        date: x.date,
        net: x.additions - x.deletions,
        cumulativeNet: runningNet,
        additions: x.additions,
        deletions: x.deletions,
      };
    });

    const totalAdd = commits.reduce((s, c) => s + Number(c.additions || 0), 0);
    const totalDel = commits.reduce((s, c) => s + Number(c.deletions || 0), 0);

    return {
      commitsByDay: commitsByDay.map((x) => ({
        ...x,
        intensity: Math.round((x.commits / maxDayCommits) * 100),
      })),
      commitsByHour: byHour,
      commitsByAuthor,
      topFiles,
      netLinesByDay,
      totals: {
        commits: commits.length,
        additions: totalAdd,
        deletions: totalDel,
        netLines: totalAdd - totalDel,
        authors: byAuthor.size,
        activeDays: byDay.size,
      },
    };
  }

  private buildFileStatusStats(
    commits: Array<{ files?: unknown }>,
  ): { added: number; modified: number; removed: number; renamed: number } {
    const stats = { added: 0, modified: 0, removed: 0, renamed: 0 };
    for (const c of commits) {
      if (!Array.isArray(c.files)) continue;
      for (const f of c.files as Array<{ status?: string }>) {
        const s = String(f?.status || 'modified').toLowerCase();
        if (s === 'added') stats.added += 1;
        else if (s === 'removed') stats.removed += 1;
        else if (s === 'renamed') stats.renamed += 1;
        else stats.modified += 1;
      }
    }
    return stats;
  }

  private buildTopFiles(
    commits: Array<{ files?: unknown }>,
    limit = 12,
  ): Array<{
    filename: string;
    touches: number;
    additions: number;
    deletions: number;
    added: number;
    modified: number;
    removed: number;
  }> {
    const map = new Map<
      string,
      {
        filename: string;
        touches: number;
        additions: number;
        deletions: number;
        added: number;
        modified: number;
        removed: number;
      }
    >();
    for (const c of commits) {
      if (!Array.isArray(c.files)) continue;
      for (const raw of c.files as Array<{
        filename?: string;
        status?: string;
        additions?: number;
        deletions?: number;
      }>) {
        const filename = raw?.filename;
        if (!filename) continue;
        const row = map.get(filename) || {
          filename,
          touches: 0,
          additions: 0,
          deletions: 0,
          added: 0,
          modified: 0,
          removed: 0,
        };
        row.touches += 1;
        row.additions += Number(raw.additions || 0);
        row.deletions += Number(raw.deletions || 0);
        const s = String(raw.status || 'modified').toLowerCase();
        if (s === 'added') row.added += 1;
        else if (s === 'removed') row.removed += 1;
        else row.modified += 1;
        map.set(filename, row);
      }
    }
    return [...map.values()]
      .sort((a, b) => b.touches - a.touches || b.additions - a.additions)
      .slice(0, limit);
  }

  private buildCommitSummary(
    commits: Array<{
      pusher: string;
      additions?: number | null;
      deletions?: number | null;
      changedFiles?: number | null;
      authorLogin?: string | null;
      files?: unknown;
    }>,
  ) {
    const authors = new Set<string>();
    let additions = 0;
    let deletions = 0;
    let filesTouched = 0;
    const fileSet = new Set<string>();

    for (const c of commits) {
      if (c.authorLogin) authors.add(c.authorLogin);
      else if (c.pusher) authors.add(c.pusher);
      additions += Number(c.additions || 0);
      deletions += Number(c.deletions || 0);
      filesTouched += Number(c.changedFiles || 0);
      if (Array.isArray(c.files)) {
        for (const f of c.files as Array<{ filename?: string } | string>) {
          const name = typeof f === 'string' ? f : f?.filename;
          if (name) fileSet.add(name);
        }
      }
    }

    return {
      commitCount: commits.length,
      authorCount: authors.size,
      authors: [...authors].slice(0, 20),
      additions,
      deletions,
      changedFilesEvents: filesTouched,
      uniqueFiles: fileSet.size,
      topFiles: [...fileSet].slice(0, 30),
    };
  }

  private async upsertCommitFromPush(input: {
    teamId: number;
    commit: any;
    pusher: string;
    owner?: string | null;
    repo?: string | null;
  }) {
    const hash = String(input.commit.id || input.commit.sha || '');
    if (!hash) return null;

    let additions: number | null = null;
    let deletions: number | null = null;
    let changedFiles: number | null = null;
    let files: any = null;
    let authorLogin: string | null = null;
    let authorName: string | null = null;

    if (input.owner && input.repo) {
      const detail = await this.githubService.getCommitDetail(
        input.owner,
        input.repo,
        hash,
      );
      if (detail) {
        additions = detail.additions;
        deletions = detail.deletions;
        changedFiles = detail.changedFiles;
        files = detail.files;
        authorLogin = detail.authorLogin;
        authorName = detail.authorName;
      }
    }

    const data = {
      message: String(input.commit.message || 'No message'),
      pusher: String(input.pusher || authorLogin || 'Unknown'),
      url: String(input.commit.url || input.commit.html_url || ''),
      timestamp: new Date(input.commit.timestamp || input.commit.added || Date.now()),
      additions,
      deletions,
      changedFiles,
      files: files ?? undefined,
      authorLogin,
      authorName,
    };

    return this.prisma.githubCommit.upsert({
      where: {
        teamId_commitHash: { teamId: input.teamId, commitHash: hash },
      },
      create: {
        teamId: input.teamId,
        commitHash: hash,
        ...data,
      },
      update: data,
    });
  }

  private async upsertCommitFromApiList(input: {
    teamId: number;
    owner: string;
    repo: string;
    commit: any;
    enrich: boolean;
  }): Promise<{ created: boolean; enriched: boolean }> {
    const hash = String(input.commit.sha || '');
    if (!hash) return { created: false, enriched: false };

    const existing = await this.prisma.githubCommit.findUnique({
      where: {
        teamId_commitHash: { teamId: input.teamId, commitHash: hash },
      },
    });

    let detail = null as Awaited<
      ReturnType<GithubService['getCommitDetail']>
    >;
    const needsEnrich =
      input.enrich &&
      (!existing ||
        existing.additions == null ||
        existing.changedFiles == null ||
        existing.files == null);

    if (needsEnrich) {
      detail = await this.githubService.getCommitDetail(
        input.owner,
        input.repo,
        hash,
      );
    }

    const base = {
      message: String(input.commit.commit?.message || detail?.message || 'No message'),
      pusher: String(
        input.commit.author?.login ||
          input.commit.commit?.author?.name ||
          detail?.authorLogin ||
          'Unknown',
      ),
      url: String(input.commit.html_url || detail?.htmlUrl || ''),
      timestamp: new Date(
        input.commit.commit?.author?.date ||
          detail?.timestamp ||
          new Date(),
      ),
      additions: detail?.additions ?? existing?.additions ?? null,
      deletions: detail?.deletions ?? existing?.deletions ?? null,
      changedFiles: detail?.changedFiles ?? existing?.changedFiles ?? null,
      files: detail?.files ?? existing?.files ?? undefined,
      authorLogin:
        detail?.authorLogin ??
        input.commit.author?.login ??
        existing?.authorLogin ??
        null,
      authorName:
        detail?.authorName ??
        input.commit.commit?.author?.name ??
        existing?.authorName ??
        null,
    };

    await this.prisma.githubCommit.upsert({
      where: {
        teamId_commitHash: { teamId: input.teamId, commitHash: hash },
      },
      create: {
        teamId: input.teamId,
        commitHash: hash,
        ...base,
      },
      update: base,
    });

    return {
      created: !existing,
      enriched: Boolean(detail),
    };
  }
}
