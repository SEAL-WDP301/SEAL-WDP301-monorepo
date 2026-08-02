import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface CreatedGithubRepo {
  name: string;
  htmlUrl: string;
  cloneUrl: string;
}

interface GithubCreateRepoResponse {
  name: string;
  html_url: string;
  clone_url: string;
}

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(private readonly configService: ConfigService) { }

  isConfigured(): boolean {
    return Boolean(this.configService.get<string>("github.token"));
  }

  resolveOrgName(githubOrgUrl?: string | null): string | null {
    const fromEvent = githubOrgUrl ? this.parseOrgFromUrl(githubOrgUrl) : null;
    if (fromEvent) return fromEvent;

    const fallback = this.configService.get<string>("github.org");
    return fallback || null;
  }

  buildRepoName(
    event: { id: number; year: number; season: string },
    team: { id: number; name: string },
  ): string {
    const slug = team.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24);

    const base = `seal-${event.year}-${event.season.toLowerCase()}-${slug || "team"}-t${team.id}`;
    return base.slice(0, 100);
  }

  async createTeamRepository(input: {
    org: string;
    repoName: string;
    description: string;
  }): Promise<CreatedGithubRepo> {
    const token = this.configService.get<string>("github.token");
    if (!token) {
      throw new ServiceUnavailableException(
        "GitHub integration is not configured (missing GITHUB_TOKEN)",
      );
    }

    const privateRepo = this.configService.get<boolean>("github.repoPrivate");
    const autoInit = this.configService.get<boolean>("github.autoInit");

    const response = await fetch(
      `https://api.github.com/orgs/${input.org}/repos`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: input.repoName,
          description: input.description,
          private: privateRepo,
          auto_init: autoInit,
        }),
      },
    );

    if (response.status === 422) {
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new BadRequestException(
        body.message ||
        `GitHub repo "${input.repoName}" already exists or name is invalid`,
      );
    }

    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      this.logger.error(
        `GitHub create repo failed (${response.status}): ${body}`,
      );
      throw new ServiceUnavailableException(
        `Failed to create GitHub repository (${response.status})`,
      );
    }

    const repo = (await response.json()) as GithubCreateRepoResponse;
    return {
      name: repo.name,
      htmlUrl: repo.html_url,
      cloneUrl: repo.clone_url,
    };
  }

  async addCollaborator(
    org: string,
    repoName: string,
    username: string,
    permission: "pull" | "push" | "admin" = "push",
  ): Promise<void> {
    const token = this.configService.get<string>("github.token");
    if (!token) return;

    const response = await fetch(
      `https://api.github.com/repos/${org}/${repoName}/collaborators/${username}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ permission }),
      },
    );

    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      this.logger.error(
        `Failed to add collaborator ${username} to ${repoName}: ${body}`,
      );
    }
  }

  async removeCollaborator(
    org: string,
    repoName: string,
    username: string,
  ): Promise<void> {
    const token = this.configService.get<string>("github.token");
    if (!token) return;

    const response = await fetch(
      `https://api.github.com/repos/${org}/${repoName}/collaborators/${username}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      this.logger.error(
        `Failed to remove collaborator ${username} from ${repoName}: ${body}`,
      );
    }
  }

  private parseOrgFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url.trim());
      if (parsed.hostname !== "github.com") return null;

      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length === 0) return null;

      if (segments[0] === "orgs" && segments[1]) {
        return segments[1];
      }

      return segments[0];
    } catch {
      return null;
    }
  }

  async getRepoCollaborators(org: string, repoName: string): Promise<any[]> {
    const token = this.configService.get<string>("github.token");
    if (!token) return [];

    const response = await fetch(
      `https://api.github.com/repos/${org}/${repoName}/collaborators`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!response.ok) return [];
    return response.json();
  }

  async getRepoInvitations(org: string, repoName: string): Promise<any[]> {
    const token = this.configService.get<string>("github.token");
    if (!token) return [];

    const response = await fetch(
      `https://api.github.com/repos/${org}/${repoName}/invitations`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!response.ok) return [];
    return response.json();
  }

  private authHeaders(): Record<string, string> {
    const token = (this.configService.get<string>("github.token") || "").trim();
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "SEAL-Hackathon-Platform",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  async getRepoCommits(
    org: string,
    repoName: string,
    perPage = 100,
    page = 1,
  ): Promise<any[]> {
    const response = await fetch(
      `https://api.github.com/repos/${org}/${repoName}/commits?per_page=${perPage}&page=${page}`,
      {
        method: "GET",
        headers: this.authHeaders(),
      },
    );

    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      this.logger.error(`Failed to fetch commits for ${repoName}: ${body}`);
      return [];
    }
    return response.json();
  }

  /** Fetch up to `maxPages` pages (100/page) for one team — keeps quota bounded. */
  async getRepoCommitsPaged(
    org: string,
    repoName: string,
    maxPages = 3,
  ): Promise<any[]> {
    const all: any[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const batch = await this.getRepoCommits(org, repoName, 100, page);
      if (!batch.length) break;
      all.push(...batch);
      if (batch.length < 100) break;
    }
    return all;
  }

  private async safeJson(url: string): Promise<any> {
    const response = await fetch(url, { headers: this.authHeaders() });
    if (!response.ok) return null;
    return response.json().catch(() => null);
  }

  private async safeJsonArray(url: string): Promise<any[]> {
    const data = await this.safeJson(url);
    return Array.isArray(data) ? data : [];
  }

  async getRepoActivityExtras(owner: string, repo: string): Promise<{
    pullRequests: Array<{
      number: number;
      title: string;
      state: string;
      user: string | null;
      createdAt: string | null;
      mergedAt: string | null;
      htmlUrl: string;
      additions: number | null;
      deletions: number | null;
      changedFiles: number | null;
    }>;
    branches: Array<{ name: string; protected: boolean }>;
    workflowRuns: Array<{
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      htmlUrl: string;
      createdAt: string | null;
      headBranch: string | null;
    }>;
    releases: Array<{
      id: number;
      tagName: string;
      name: string;
      publishedAt: string | null;
      htmlUrl: string;
      draft: boolean;
      prerelease: boolean;
    }>;
    openIssues: Array<{
      number: number;
      title: string;
      user: string | null;
      createdAt: string | null;
      htmlUrl: string;
      comments: number;
    }>;
    tags: Array<{ name: string; commitSha: string }>;
  }> {
    const base = `https://api.github.com/repos/${owner}/${repo}`;
    const [prs, branches, runsBody, releases, issues, tags] = await Promise.all([
      this.safeJsonArray(`${base}/pulls?state=all&per_page=20&sort=updated`),
      this.safeJsonArray(`${base}/branches?per_page=30`),
      this.safeJson(`${base}/actions/runs?per_page=15`),
      this.safeJsonArray(`${base}/releases?per_page=10`),
      this.safeJsonArray(
        `${base}/issues?state=open&per_page=15&sort=updated`,
      ),
      this.safeJsonArray(`${base}/tags?per_page=15`),
    ]);

    const pureIssues = issues.filter((i: any) => !i.pull_request);
    const workflowRunsRaw = Array.isArray(runsBody?.workflow_runs)
      ? runsBody.workflow_runs
      : [];

    return {
      pullRequests: prs.slice(0, 20).map((p: any) => ({
        number: Number(p.number || 0),
        title: String(p.title || ""),
        state: p.merged_at ? "merged" : String(p.state || "open"),
        user: p.user?.login ? String(p.user.login) : null,
        createdAt: p.created_at ? String(p.created_at) : null,
        mergedAt: p.merged_at ? String(p.merged_at) : null,
        htmlUrl: String(p.html_url || ""),
        additions: p.additions != null ? Number(p.additions) : null,
        deletions: p.deletions != null ? Number(p.deletions) : null,
        changedFiles: p.changed_files != null ? Number(p.changed_files) : null,
      })),
      branches: branches.slice(0, 30).map((b: any) => ({
        name: String(b.name || ""),
        protected: Boolean(b.protected),
      })),
      workflowRuns: workflowRunsRaw.slice(0, 15).map((r: any) => ({
        id: Number(r.id || 0),
        name: String(r.name || r.display_title || "workflow"),
        status: String(r.status || "unknown"),
        conclusion: r.conclusion ? String(r.conclusion) : null,
        htmlUrl: String(r.html_url || ""),
        createdAt: r.created_at ? String(r.created_at) : null,
        headBranch: r.head_branch ? String(r.head_branch) : null,
      })),
      releases: releases.slice(0, 10).map((r: any) => ({
        id: Number(r.id || 0),
        tagName: String(r.tag_name || ""),
        name: String(r.name || r.tag_name || ""),
        publishedAt: r.published_at ? String(r.published_at) : null,
        htmlUrl: String(r.html_url || ""),
        draft: Boolean(r.draft),
        prerelease: Boolean(r.prerelease),
      })),
      openIssues: pureIssues.slice(0, 15).map((i: any) => ({
        number: Number(i.number || 0),
        title: String(i.title || ""),
        user: i.user?.login ? String(i.user.login) : null,
        createdAt: i.created_at ? String(i.created_at) : null,
        htmlUrl: String(i.html_url || ""),
        comments: Number(i.comments || 0),
      })),
      tags: tags.slice(0, 15).map((t: any) => ({
        name: String(t.name || ""),
        commitSha: String(t.commit?.sha || "").slice(0, 7),
      })),
    };
  }

  async getCommitDetail(
    owner: string,
    repo: string,
    sha: string,
  ): Promise<{
    sha: string;
    htmlUrl: string;
    message: string;
    authorLogin: string | null;
    authorName: string | null;
    timestamp: Date;
    additions: number;
    deletions: number;
    changedFiles: number;
    files: Array<{
      filename: string;
      status: string;
      additions: number;
      deletions: number;
      changes: number;
    }>;
  } | null> {
    if (!sha) return null;

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(sha)}`,
      {
        method: "GET",
        headers: this.authHeaders(),
      },
    );

    if (!response.ok) {
      this.logger.warn(
        `Commit detail ${owner}/${repo}@${sha.slice(0, 7)} → HTTP ${response.status}`,
      );
      return null;
    }

    const data = (await response.json()) as any;
    const files = Array.isArray(data.files)
      ? data.files.slice(0, 100).map((f: any) => ({
          filename: String(f.filename || ""),
          status: String(f.status || "modified"),
          additions: Number(f.additions || 0),
          deletions: Number(f.deletions || 0),
          changes: Number(f.changes || 0),
        }))
      : [];

    return {
      sha: String(data.sha || sha),
      htmlUrl: String(data.html_url || ""),
      message: String(data.commit?.message || "No message"),
      authorLogin: data.author?.login || null,
      authorName: data.commit?.author?.name || null,
      timestamp: new Date(
        data.commit?.author?.date || data.commit?.committer?.date || Date.now(),
      ),
      additions: Number(data.stats?.additions || 0),
      deletions: Number(data.stats?.deletions || 0),
      changedFiles: Number(data.files?.length || files.length || 0),
      files,
    };
  }

  async getRepoInsights(owner: string, repo: string): Promise<{
    fullName: string;
    htmlUrl: string;
    description: string | null;
    defaultBranch: string | null;
    language: string | null;
    languages: Record<string, number>;
    stars: number;
    forks: number;
    watchers: number;
    openIssues: number;
    sizeKb: number;
    createdAt: string | null;
    pushedAt: string | null;
    contributors: Array<{ login: string; contributions: number; avatarUrl: string | null }>;
    contributorCount: number;
  } | null> {
    const headers = this.authHeaders();
    const [repoRes, langRes, contribRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
      fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, {
        headers,
      }),
      fetch(
        `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=30`,
        { headers },
      ),
    ]);

    if (!repoRes.ok) {
      this.logger.warn(
        `Repo insights ${owner}/${repo} → HTTP ${repoRes.status}`,
      );
      return null;
    }

    const repoData = (await repoRes.json()) as any;
    const languages = langRes.ok
      ? ((await langRes.json()) as Record<string, number>)
      : {};
    const contributorsRaw = contribRes.ok ? ((await contribRes.json()) as any[]) : [];
    const contributors = (Array.isArray(contributorsRaw) ? contributorsRaw : [])
      .slice(0, 20)
      .map((c) => ({
        login: String(c.login || "unknown"),
        contributions: Number(c.contributions || 0),
        avatarUrl: c.avatar_url ? String(c.avatar_url) : null,
      }));

    return {
      fullName: String(repoData.full_name || `${owner}/${repo}`),
      htmlUrl: String(repoData.html_url || `https://github.com/${owner}/${repo}`),
      description: repoData.description ? String(repoData.description) : null,
      defaultBranch: repoData.default_branch
        ? String(repoData.default_branch)
        : null,
      language: repoData.language ? String(repoData.language) : null,
      languages,
      stars: Number(repoData.stargazers_count || 0),
      forks: Number(repoData.forks_count || 0),
      watchers: Number(repoData.subscribers_count || repoData.watchers_count || 0),
      openIssues: Number(repoData.open_issues_count || 0),
      sizeKb: Number(repoData.size || 0),
      createdAt: repoData.created_at ? String(repoData.created_at) : null,
      pushedAt: repoData.pushed_at ? String(repoData.pushed_at) : null,
      contributors,
      contributorCount: contributors.length,
    };
  }
}
