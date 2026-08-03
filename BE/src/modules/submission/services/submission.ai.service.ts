import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, RoundStatus, SubmissionType } from "@prisma/client";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { SubmissionJudgeService } from "./submission.judge.service";

const MAX_CONTEXT_CHARS = 24_000;
const MAX_COMMITS = 20;
const MAX_REPO_FILES = 12;
const MAX_FILE_CHARS = 3_500;
const MAX_ZIP_FILES = 18;
const MAX_DOWNLOAD_BYTES = 40 * 1024 * 1024;
const OFFICE_IN_ZIP_EXTS = new Set(["docx", "pptx", "pdf"]);

const TEXT_EXTS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "csv",
  "log",
  "yml",
  "yaml",
  "xml",
  "html",
  "htm",
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "java",
  "go",
  "rs",
  "rb",
  "php",
  "cs",
  "cpp",
  "c",
  "h",
  "hpp",
  "css",
  "scss",
  "sql",
  "sh",
  "bat",
  "ps1",
  "toml",
  "ini",
  "env",
  "dockerfile",
  "gitignore",
  "prisma",
  "kt",
  "swift",
  "vue",
  "svelte",
]);

const SKIP_PATH_PARTS = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  ".next/",
  "coverage/",
  "vendor/",
  "__pycache__/",
  ".venv/",
  "venv/",
];

type CriterionContext = {
  id: number;
  name: string;
  description: string | null;
  maxScore: number;
  weight: number;
};

export type AiScoreSuggestion = {
  criterionId: number;
  scoreValue: number;
  comment: string;
};

export type AiSuggestScoresResult = {
  auditId: number;
  suggestions: AiScoreSuggestion[];
  source: "file" | "github_link";
  contextSummary: string;
};

export type SubmissionEvidenceBundle = {
  submissionId: number;
  teamId: number;
  teamName: string;
  description: string | null;
  eventName: string;
  roundName: string;
  trackName: string | null;
  source: "file" | "github_link";
  evidenceText: string;
  contextSummary: string;
  fileUrl: string | null;
  githubUrl: string | null;
};

@Injectable()
export class SubmissionAiService {
  private readonly logger = new Logger(SubmissionAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly judgeService: SubmissionJudgeService,
  ) {}

  requireOpenAiApiKey(): string {
    const apiKey = this.configService.get<string>("ai.openaiApiKey") || "";
    if (!apiKey.trim()) {
      throw new ServiceUnavailableException(
        "AI assist is not configured. Set OPENAI_API_KEY on the server.",
      );
    }
    return apiKey;
  }
  async collectSubmissionEvidence(
    submissionId: number,
  ): Promise<SubmissionEvidenceBundle> {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            githubRepoUrl: true,
            track: { select: { id: true, name: true } },
          },
        },
        round: {
          select: {
            id: true,
            name: true,
            submissionType: true,
            status: true,
            submissionDeadline: true,
            event: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException("Submission not found");
    }

    const source: "file" | "github_link" =
      submission.round.submissionType === SubmissionType.github_link
        ? "github_link"
        : "file";

    const { evidenceText, contextSummary } =
      source === "github_link"
        ? await this.buildGithubContext(submission)
        : await this.buildFileContext(submission);

    return {
      submissionId: submission.id,
      teamId: submission.team.id,
      teamName: submission.team.name,
      description: submission.description,
      eventName: submission.round.event.name,
      roundName: submission.round.name,
      trackName: submission.team.track?.name ?? null,
      source,
      evidenceText,
      contextSummary,
      fileUrl: submission.fileUrl,
      githubUrl: submission.githubUrl,
    };
  }

  async requestJsonCompletion(input: {
    apiKey: string;
    system: string;
    user: string;
    temperature?: number;
    timeoutMs?: number;
  }): Promise<unknown> {
    const model =
      this.configService.get<string>("ai.openaiModel") || "gpt-4o-mini";
    const baseUrl =
      this.configService.get<string>("ai.openaiBaseUrl") ||
      "https://api.openai.com/v1";

    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: input.temperature ?? 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user },
          ],
        }),
        signal: AbortSignal.timeout(input.timeoutMs ?? 90_000),
      },
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      this.logger.error(
        `OpenAI error ${response.status}: ${errText.slice(0, 500)}`,
      );
      throw new ServiceUnavailableException(
        `AI provider error (${response.status}). Check OPENAI_API_KEY / quota.`,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new ServiceUnavailableException("AI returned an empty response.");
    }

    try {
      return JSON.parse(content);
    } catch {
      throw new ServiceUnavailableException("AI returned invalid JSON.");
    }
  }

  async suggestScores(
    judgeId: number,
    submissionId: number,
  ): Promise<AiSuggestScoresResult> {
    const apiKey = this.requireOpenAiApiKey();

    const detail = await this.judgeService.getSubmissionDetail(
      judgeId,
      submissionId,
    );
    const teamId = detail.teamId ?? detail.team.id;
    if (teamId != null) {
      await this.judgeService.assertNotMentoringTeam(judgeId, teamId);
    }
    this.judgeService.assertRoundAllowsScoring({
      status: detail.round.status as RoundStatus,
      submissionDeadline: detail.round.submissionDeadline
        ? new Date(detail.round.submissionDeadline)
        : null,
    });

    const evidence = await this.collectSubmissionEvidence(submissionId);

    const rubrics: CriterionContext[] = detail.rubrics.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? null,
      maxScore: Number(r.maxScore),
      weight: Number(r.weight),
    }));

    if (rubrics.length === 0) {
      throw new ServiceUnavailableException(
        "No rubrics available for AI suggestions on this submission.",
      );
    }

    const suggestions = await this.callOpenAi({
      apiKey,
      source: evidence.source,
      contextSummary: evidence.contextSummary,
      evidenceText: evidence.evidenceText,
      description: evidence.description,
      eventName: evidence.eventName,
      roundName: evidence.roundName,
      trackName: evidence.trackName,
      rubrics,
    });

    const audit = await this.prisma.aiScoreSuggestionLog.create({
      data: {
        submissionId,
        judgeId,
        source: evidence.source,
        contextSummary: evidence.contextSummary,
        suggestions: suggestions as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      auditId: audit.id,
      suggestions,
      source: evidence.source,
      contextSummary: evidence.contextSummary,
    };
  }

  async markSuggestionApplied(judgeId: number, auditId: number) {
    const log = await this.prisma.aiScoreSuggestionLog.findUnique({
      where: { id: auditId },
      include: {
        submission: {
          include: {
            round: {
              select: { status: true, submissionDeadline: true },
            },
          },
        },
      },
    });

    if (!log) {
      throw new NotFoundException("AI suggestion audit log not found");
    }
    if (log.judgeId !== judgeId) {
      throw new ForbiddenException("You cannot apply another judge's AI draft");
    }
    if (log.discardedAt) {
      throw new BadRequestException("This AI draft was discarded");
    }

    this.judgeService.assertRoundAllowsScoring(log.submission.round);

    return this.prisma.aiScoreSuggestionLog.update({
      where: { id: auditId },
      data: { appliedAt: new Date(), discardedAt: null },
    });
  }

  async markSuggestionDiscarded(judgeId: number, auditId: number) {
    const log = await this.prisma.aiScoreSuggestionLog.findUnique({
      where: { id: auditId },
    });

    if (!log) {
      throw new NotFoundException("AI suggestion audit log not found");
    }
    if (log.judgeId !== judgeId) {
      throw new ForbiddenException(
        "You cannot discard another judge's AI draft",
      );
    }

    return this.prisma.aiScoreSuggestionLog.update({
      where: { id: auditId },
      data: {
        discardedAt: new Date(),
        appliedAt: null,
      },
    });
  }

  private async buildGithubContext(submission: {
    id: number;
    description: string | null;
    githubUrl: string | null;
    team: { id: number; githubRepoUrl: string | null };
  }): Promise<{ evidenceText: string; contextSummary: string }> {
    const githubUrl =
      submission.githubUrl?.trim() ||
      submission.team.githubRepoUrl?.trim() ||
      "";

    const commits = await this.prisma.githubCommit.findMany({
      where: { teamId: submission.team.id },
      orderBy: { timestamp: "desc" },
      take: MAX_COMMITS,
      select: {
        message: true,
        pusher: true,
        timestamp: true,
        url: true,
        commitHash: true,
      },
    });

    const commitBlock =
      commits.length === 0
        ? "No GitHub commits recorded for this team in SEAL DB."
        : commits
            .map(
              (c, i) =>
                `${i + 1}. [${c.timestamp?.toISOString?.() ?? "unknown"}] ${c.pusher || "unknown"}: ${c.message || "(no message)"} (${c.commitHash?.slice(0, 7) || "?"})`,
            )
            .join("\n");

    const repoSnapshot = await this.fetchGithubRepoSnapshot(githubUrl);

    const parts = [
      `GitHub URL: ${githubUrl || "(missing)"}`,
      `Recent commits from SEAL webhook DB (${commits.length}):`,
      commitBlock,
    ];

    if (repoSnapshot.treePreview) {
      parts.push("Repository file tree (selected):", repoSnapshot.treePreview);
    }
    if (repoSnapshot.filesBlock) {
      parts.push("Fetched source/document contents:", repoSnapshot.filesBlock);
    }
    if (repoSnapshot.note) {
      parts.push(`Note: ${repoSnapshot.note}`);
    }

    const evidenceText = this.truncate(parts.join("\n\n"), MAX_CONTEXT_CHARS);
    const contextSummary = [
      `${commits.length} commits`,
      repoSnapshot.filesFetched > 0
        ? `${repoSnapshot.filesFetched} repo files read`
        : null,
      repoSnapshot.readmeFetched ? "README" : null,
      repoSnapshot.note ? "partial access" : null,
    ]
      .filter(Boolean)
      .join(" + ");

    return {
      evidenceText,
      contextSummary: contextSummary || "GitHub URL only",
    };
  }

  private async fetchGithubRepoSnapshot(githubUrl: string): Promise<{
    filesFetched: number;
    readmeFetched: boolean;
    treePreview: string;
    filesBlock: string;
    note: string;
  }> {
    const empty = {
      filesFetched: 0,
      readmeFetched: false,
      treePreview: "",
      filesBlock: "",
      note: "",
    };

    const parsed = this.parseGithubRepo(githubUrl);
    if (!parsed) {
      return { ...empty, note: "Could not parse GitHub owner/repo from URL." };
    }

    const { owner, repo } = parsed;
    const headers = this.githubHeaders();

    try {
      const repoRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers, signal: AbortSignal.timeout(12_000) },
      );
      if (!repoRes.ok) {
        return {
          ...empty,
          note: `GitHub repo API returned HTTP ${repoRes.status}. Private repos need GITHUB_TOKEN with access.`,
        };
      }

      const repoJson = (await repoRes.json()) as {
        default_branch?: string;
        private?: boolean;
      };
      const branch = repoJson.default_branch || "main";

      const treeRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        { headers, signal: AbortSignal.timeout(20_000) },
      );
      if (!treeRes.ok) {
        const readme = await this.fetchGithubReadme(githubUrl);
        return {
          ...empty,
          readmeFetched: Boolean(readme),
          filesBlock: readme
            ? `--- FILE: README ---\n${readme}`
            : "",
          filesFetched: readme ? 1 : 0,
          note: `Could not list repo tree (HTTP ${treeRes.status}).`,
        };
      }

      const treeJson = (await treeRes.json()) as {
        truncated?: boolean;
        tree?: Array<{ path?: string; type?: string; size?: number }>;
      };
      const blobs = (treeJson.tree || [])
        .filter((n) => n.type === "blob" && n.path)
        .filter((n) => !this.shouldSkipPath(n.path!))
        .filter((n) => this.isTextPath(n.path!))
        .filter((n) => (n.size ?? 0) > 0 && (n.size ?? 0) <= 200_000);

      const ranked = blobs
        .map((n) => ({
          path: n.path!,
          size: n.size ?? 0,
          score: this.scoreRepoPath(n.path!),
        }))
        .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
        .slice(0, MAX_REPO_FILES);

      const treePreview = ranked
        .map((f, i) => `${i + 1}. ${f.path} (${f.size} bytes)`)
        .join("\n");

      const fileChunks: string[] = [];
      let filesFetched = 0;
      let readmeFetched = false;
      let budget = Math.floor(MAX_CONTEXT_CHARS * 0.75);

      for (const file of ranked) {
        if (budget < 400) break;
        const content = await this.fetchGithubFileRaw(
          owner,
          repo,
          branch,
          file.path,
        );
        if (!content) continue;
        const clipped = this.truncate(
          content,
          Math.min(MAX_FILE_CHARS, budget),
        );
        fileChunks.push(`--- FILE: ${file.path} ---\n${clipped}`);
        budget -= clipped.length + file.path.length + 40;
        filesFetched += 1;
        if (/readme/i.test(file.path)) readmeFetched = true;
      }

      return {
        filesFetched,
        readmeFetched,
        treePreview,
        filesBlock: fileChunks.join("\n\n"),
        note: treeJson.truncated
          ? "GitHub tree was truncated; only a ranked subset of files was read."
          : repoJson.private
            ? "Private repository accessed via GITHUB_TOKEN."
            : "",
      };
    } catch (err) {
      this.logger.warn(`GitHub snapshot failed: ${String(err)}`);
      const readme = await this.fetchGithubReadme(githubUrl);
      return {
        ...empty,
        readmeFetched: Boolean(readme),
        filesBlock: readme ? `--- FILE: README ---\n${readme}` : "",
        filesFetched: readme ? 1 : 0,
        note: "Failed to deep-read GitHub repo; used README fallback if available.",
      };
    }
  }

  private async fetchGithubFileRaw(
    owner: string,
    repo: string,
    branch: string,
    path: string,
  ): Promise<string | null> {
    const headers = this.githubHeaders();
    headers.Accept = "application/vnd.github.raw";

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}?ref=${encodeURIComponent(branch)}`;
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;

    for (const url of [apiUrl, rawUrl]) {
      try {
        const res = await fetch(url, {
          headers: url.includes("api.github.com")
            ? headers
            : { "User-Agent": "SEAL-AI-Scoring" },
          signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) continue;
        const text = (await res.text()).trim();
        if (text) return text;
      } catch {
      }
    }
    return null;
  }

  private scoreRepoPath(path: string): number {
    const lower = path.toLowerCase();
    const base = lower.split("/").pop() || lower;
    let score = 0;

    if (/^readme(\.|$)/i.test(base)) score += 100;
    if (
      [
        "package.json",
        "pyproject.toml",
        "requirements.txt",
        "pom.xml",
        "go.mod",
        "cargo.toml",
        "dockerfile",
        "docker-compose.yml",
        "prisma.schema",
        "schema.prisma",
      ].includes(base)
    ) {
      score += 80;
    }
    if (
      lower.includes("/src/") ||
      lower.includes("/app/") ||
      lower.includes("/lib/") ||
      lower.includes("/api/") ||
      lower.includes("/backend/") ||
      lower.includes("/frontend/")
    ) {
      score += 40;
    }
    if (/\.(ts|tsx|js|jsx|py|java|go|rs|cs|php)$/i.test(base)) score += 25;
    if (/\.(md|txt)$/i.test(base)) score += 15;
    if (
      /lock|min\.js|\.map$|\.svg$|\.png$|\.jpg$|\.jpeg$|\.gif$|\.webp$|\.ico$/i.test(
        base,
      )
    ) {
      score -= 50;
    }
    score -= Math.min(20, path.split("/").length);
    return score;
  }

  private shouldSkipPath(path: string): boolean {
    const lower = path.replace(/\\/g, "/").toLowerCase();
    return SKIP_PATH_PARTS.some((p) => lower.includes(p));
  }

  private isTextPath(path: string): boolean {
    const base = path.split("/").pop() || path;
    if (/^dockerfile$/i.test(base) || /^\.gitignore$/i.test(base)) return true;
    const ext = (base.split(".").pop() || "").toLowerCase();
    return TEXT_EXTS.has(ext);
  }

  private githubHeaders(): Record<string, string> {
    const token = this.configService.get<string>("github.token") || "";
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "SEAL-AI-Scoring",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  private async buildFileContext(submission: {
    fileUrl: string | null;
    fileKey: string | null;
    description: string | null;
  }): Promise<{ evidenceText: string; contextSummary: string }> {
    const fileUrl = submission.fileUrl?.trim() || "";
    const fileName =
      submission.fileKey?.split("/").pop() ||
      (fileUrl
        ? decodeURIComponent(fileUrl.split("/").pop() || "attachment")
        : "attachment");

    if (!fileUrl) {
      return {
        evidenceText:
          "No file attachment URL on this submission. Judge should review manually.",
        contextSummary: "No attachment file available",
      };
    }

    const ext = (fileName.split(".").pop() || "").toLowerCase();

    try {
      const response = await fetch(fileUrl, {
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        return {
          evidenceText: `File URL: ${fileUrl}\nFile name: ${fileName}\nCould not download file (HTTP ${response.status}). Judge must open the file manually.`,
          contextSummary: `File metadata only (${fileName})`,
        };
      }

      const contentType = response.headers.get("content-type") || "";
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > MAX_DOWNLOAD_BYTES) {
        return {
          evidenceText: `File URL: ${fileUrl}\nFile name: ${fileName}\nFile too large (${buffer.length} bytes). Judge must open manually.`,
          contextSummary: `File too large (${fileName})`,
        };
      }

      if (ext === "pdf" || contentType.includes("application/pdf")) {
        return this.extractPdfContextAsync(fileUrl, fileName, buffer);
      }

      if (
        ext === "zip" ||
        contentType.includes("application/zip") ||
        contentType.includes("application/x-zip") ||
        (contentType.includes("application/octet-stream") &&
          fileName.toLowerCase().endsWith(".zip"))
      ) {
        return this.extractZipContext(fileUrl, fileName, buffer);
      }

      if (ext === "docx" || contentType.includes("wordprocessingml")) {
        return this.extractDocxContext(fileUrl, fileName, buffer);
      }

      if (ext === "pptx" || contentType.includes("presentationml")) {
        return this.extractPptxContext(fileUrl, fileName, buffer);
      }

      const isText =
        TEXT_EXTS.has(ext) ||
        contentType.startsWith("text/") ||
        contentType.includes("json") ||
        contentType.includes("xml");

      if (isText) {
        const text = this.truncate(buffer.toString("utf8"), MAX_CONTEXT_CHARS);
        return {
          evidenceText: `File URL: ${fileUrl}\nFile name: ${fileName}\nExtracted attachment content:\n${text}`,
          contextSummary: `Read text attachment (${text.length} chars)`,
        };
      }

      return {
        evidenceText: `File URL: ${fileUrl}\nFile name: ${fileName}\nContent-Type: ${contentType || "unknown"}\nSize: ${buffer.length} bytes\nBinary/unsupported type for automatic reading (e.g. images/video). Judge must open the attachment manually. Score conservatively from description only.`,
        contextSummary: `Unsupported binary (${fileName})`,
      };
    } catch (err) {
      this.logger.warn(`File download failed: ${String(err)}`);
      return {
        evidenceText: `File URL: ${fileUrl}\nFile name: ${fileName}\nDownload failed. Judge must open the file manually.`,
        contextSummary: `File download failed (${fileName})`,
      };
    }
  }

  private async extractPdfContextAsync(
    fileUrl: string,
    fileName: string,
    buffer: Buffer,
  ): Promise<{ evidenceText: string; contextSummary: string }> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (
        data: Buffer,
      ) => Promise<{ text: string; numpages?: number }>;
      const parsed = await pdfParse(buffer);
      const text = this.truncate(
        (parsed.text || "").replace(/\s+/g, " ").trim(),
        MAX_CONTEXT_CHARS,
      );
      return {
        evidenceText: `File URL: ${fileUrl}\nFile name: ${fileName}\nPDF pages: ${parsed.numpages ?? "?"}\nExtracted PDF text:\n${text || "(empty)"}`,
        contextSummary: `Read PDF text (${text.length} chars, ${parsed.numpages ?? "?"} pages)`,
      };
    } catch (err) {
      this.logger.warn(`PDF extract failed: ${String(err)}`);
      return {
        evidenceText: `File URL: ${fileUrl}\nFile name: ${fileName}\nPDF text extraction failed. Judge must open the file manually.`,
        contextSummary: `PDF extract failed (${fileName})`,
      };
    }
  }

  private async extractZipContext(
    fileUrl: string,
    fileName: string,
    buffer: Buffer,
  ): Promise<{ evidenceText: string; contextSummary: string }> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AdmZip = require("adm-zip") as new (buf: Buffer) => {
        getEntries(): Array<{
          isDirectory: boolean;
          entryName: string;
          getData: () => Buffer;
        }>;
      };
      const zip = new AdmZip(buffer);
      const allFiles = zip
        .getEntries()
        .filter((e) => !e.isDirectory)
        .filter((e) => !this.shouldSkipPath(e.entryName));

      const manifest = allFiles
        .slice(0, 80)
        .map((e) => `- ${e.entryName}`)
        .join("\n");

      const readable = allFiles.filter((e) => this.isZipReadablePath(e.entryName));

      const ranked = readable
        .map((e) => ({
          entry: e,
          score: this.scoreZipEntryPath(e.entryName),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_ZIP_FILES);

      const chunks: string[] = [];
      let budget = Math.floor(MAX_CONTEXT_CHARS * 0.85);
      let filesRead = 0;
      const kinds = new Set<string>();

      for (const { entry } of ranked) {
        if (budget < 400) break;
        const data = entry.getData();
        if (!data || data.length === 0) continue;

        const ext = this.pathExt(entry.entryName);
        const maxBytes =
          ext === "pptx" ? 8_000_000 : ext === "docx" || ext === "pdf" ? 4_000_000 : 1_500_000;
        if (data.length > maxBytes) {
          chunks.push(
            `--- ZIP ENTRY: ${entry.entryName} ---\n(Skipped: ${data.length} bytes exceeds per-entry limit ${maxBytes})`,
          );
          continue;
        }

        const text = await this.extractTextFromZipEntry(entry.entryName, data);
        if (!text.trim()) {
          chunks.push(
            `--- ZIP ENTRY: ${entry.entryName} ---\n(Opened but no extractable text)`,
          );
          continue;
        }

        const clipped = this.truncate(text, Math.min(MAX_FILE_CHARS, budget));
        chunks.push(`--- ZIP ENTRY: ${entry.entryName} ---\n${clipped}`);
        budget -= clipped.length + entry.entryName.length + 40;
        filesRead += 1;
        kinds.add(ext || "text");
      }

      if (filesRead === 0) {
        return {
          evidenceText: `File URL: ${fileUrl}\nFile name: ${fileName}\nZIP opened (${allFiles.length} files) but no extractable text from ranked entries.\nArchive listing:\n${manifest || "(empty)"}\nJudge/mentor should open manually if needed.`,
          contextSummary: `ZIP opened, 0 text files readable (${allFiles.length} files listed)`,
        };
      }

      return {
        evidenceText: `File URL: ${fileUrl}\nFile name: ${fileName}\nZIP archive listing (${Math.min(allFiles.length, 80)}/${allFiles.length} shown):\n${manifest}\n\nExtracted content from ${filesRead} entries:\n\n${chunks.join("\n\n")}`,
        contextSummary: `Read ${filesRead} ZIP entries (${[...kinds].join(", ") || "mixed"})`,
      };
    } catch (err) {
      this.logger.warn(`ZIP extract failed: ${String(err)}`);
      return {
        evidenceText: `File URL: ${fileUrl}\nFile name: ${fileName}\nZIP extraction failed. Judge must open manually.`,
        contextSummary: `ZIP extract failed (${fileName})`,
      };
    }
  }

  private pathExt(path: string): string {
    const base = path.split("/").pop()?.split("\\").pop() || path;
    return (base.split(".").pop() || "").toLowerCase();
  }

  private isZipReadablePath(path: string): boolean {
    if (this.isTextPath(path)) return true;
    return OFFICE_IN_ZIP_EXTS.has(this.pathExt(path));
  }

  private scoreZipEntryPath(path: string): number {
    let score = this.scoreRepoPath(path);
    const lower = path.replace(/\\/g, "/").toLowerCase();
    const base = lower.split("/").pop() || lower;
    const ext = this.pathExt(path);

    if (ext === "docx") score += 55;
    if (ext === "pptx") score += 45;
    if (ext === "pdf") score += 50;
    if (/project|proposal|report|readme|submission|final|pitch|demo/i.test(base)) {
      score += 40;
    }
    if (lower.startsWith("slides/") || lower.includes("/slides/")) score -= 15;
    if (lower.startsWith("lab/") || lower.includes("/lab/")) score -= 10;
    return score;
  }

  private async extractTextFromZipEntry(
    entryName: string,
    data: Buffer,
  ): Promise<string> {
    const ext = this.pathExt(entryName);

    if (ext === "docx") {
      return this.extractDocxText(data);
    }
    if (ext === "pptx") {
      return this.extractPptxText(data);
    }
    if (ext === "pdf") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse") as (
          buf: Buffer,
        ) => Promise<{ text: string }>;
        const parsed = await pdfParse(data);
        return (parsed.text || "").replace(/\s+/g, " ").trim();
      } catch {
        return "";
      }
    }
    const text = data.toString("utf8");
    const sample = text.slice(0, 800);
    const weird = (sample.match(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g) || [])
      .length;
    if (weird > sample.length * 0.3) return "";
    return text.trim();
  }

  private extractDocxText(buffer: Buffer): string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AdmZip = require("adm-zip") as new (buf: Buffer) => {
        getEntry(name: string): { getData: () => Buffer } | null;
      };
      const zip = new AdmZip(buffer);
      const entry = zip.getEntry("word/document.xml");
      if (!entry) return "";
      const xml = entry.getData().toString("utf8");
      return xml
        .replace(/<w:p[^>]*>/g, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();
    } catch {
      return "";
    }
  }

  private extractPptxText(buffer: Buffer): string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AdmZip = require("adm-zip") as new (buf: Buffer) => {
        getEntries(): Array<{
          isDirectory: boolean;
          entryName: string;
          getData: () => Buffer;
        }>;
      };
      const zip = new AdmZip(buffer);
      const slides = zip
        .getEntries()
        .filter(
          (e) =>
            !e.isDirectory &&
            /^ppt\/slides\/slide\d+\.xml$/i.test(
              e.entryName.replace(/\\/g, "/"),
            ),
        )
        .sort((a, b) => a.entryName.localeCompare(b.entryName))
        .slice(0, 25);

      const chunks: string[] = [];
      for (const slide of slides) {
        const xml = slide.getData().toString("utf8");
        const matches = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map(
          (m) => m[1],
        );
        const slideText = matches.join(" ").replace(/\s+/g, " ").trim();
        if (slideText) chunks.push(slideText);
      }
      return chunks.join("\n").trim();
    } catch {
      return "";
    }
  }

  private extractDocxContext(
    fileUrl: string,
    fileName: string,
    buffer: Buffer,
  ): { evidenceText: string; contextSummary: string } {
    try {
      const text = this.truncate(this.extractDocxText(buffer), MAX_CONTEXT_CHARS);
      if (!text) {
        return {
          evidenceText: `File URL: ${fileUrl}\nFile name: ${fileName}\nDOCX opened but no extractable text.`,
          contextSummary: `DOCX unreadable (${fileName})`,
        };
      }
      return {
        evidenceText: `File URL: ${fileUrl}\nFile name: ${fileName}\nExtracted DOCX text:\n${text}`,
        contextSummary: `Read DOCX text (${text.length} chars)`,
      };
    } catch (err) {
      this.logger.warn(`DOCX extract failed: ${String(err)}`);
      return {
        evidenceText: `File URL: ${fileUrl}\nFile name: ${fileName}\nDOCX extraction failed.`,
        contextSummary: `DOCX extract failed (${fileName})`,
      };
    }
  }

  private extractPptxContext(
    fileUrl: string,
    fileName: string,
    buffer: Buffer,
  ): { evidenceText: string; contextSummary: string } {
    try {
      const joined = this.truncate(this.extractPptxText(buffer), MAX_CONTEXT_CHARS);
      if (!joined) {
        return {
          evidenceText: `File URL: ${fileUrl}\nFile name: ${fileName}\nPPTX opened but no slide text found.`,
          contextSummary: `PPTX no text (${fileName})`,
        };
      }
      return {
        evidenceText: `File URL: ${fileUrl}\nFile name: ${fileName}\nExtracted PPTX slide text:\n${joined}`,
        contextSummary: `Read PPTX slides (${joined.length} chars)`,
      };
    } catch (err) {
      this.logger.warn(`PPTX extract failed: ${String(err)}`);
      return {
        evidenceText: `File URL: ${fileUrl}\nFile name: ${fileName}\nPPTX extraction failed.`,
        contextSummary: `PPTX extract failed (${fileName})`,
      };
    }
  }

  private async fetchGithubReadme(githubUrl: string): Promise<string | null> {
    if (!githubUrl) return null;

    const parsed = this.parseGithubRepo(githubUrl);
    if (!parsed) return null;

    const { owner, repo } = parsed;
    const headers = this.githubHeaders();
    headers.Accept = "application/vnd.github.raw";

    const candidates = [
      `https://api.github.com/repos/${owner}/${repo}/readme`,
      `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`,
      `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`,
    ];

    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          headers: url.includes("api.github.com")
            ? headers
            : { "User-Agent": "SEAL-AI-Scoring" },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) continue;
        const text = (await res.text()).trim();
        if (text) {
          return this.truncate(text, Math.floor(MAX_CONTEXT_CHARS * 0.4));
        }
      } catch {
      }
    }
    return null;
  }

  private parseGithubRepo(
    url: string,
  ): { owner: string; repo: string } | null {
    try {
      const normalized = url
        .replace(/\.git$/i, "")
        .replace(/^git@github\.com:/i, "https://github.com/");
      const u = new URL(normalized);
      if (!u.hostname.includes("github.com")) return null;
      const [, owner, repo] = u.pathname.split("/");
      if (!owner || !repo) return null;
      return { owner, repo: repo.replace(/\.git$/i, "") };
    } catch {
      return null;
    }
  }

  private async callOpenAi(input: {
    apiKey: string;
    source: "file" | "github_link";
    contextSummary: string;
    evidenceText: string;
    description: string | null;
    eventName: string;
    roundName: string;
    trackName: string | null;
    rubrics: CriterionContext[];
  }): Promise<AiScoreSuggestion[]> {
    const system = `You are an assistant that helps hackathon judges draft rubric scores from REAL submission evidence.
Rules:
- Ground every comment in the provided evidence (attachment text / GitHub files / commits). Quote or cite concrete signals (file names, features, commit themes) when possible.
- Map comments to EACH criterion definition — do not give generic praise.
- Suggestions only; be conservative when evidence is weak or missing for a criterion.
- If evidence is thin for a criterion, use mid-range scores and explicitly say what is missing.
- Do not invent files, commits, APIs, or features not present in the context.
- Output JSON only: {"suggestions":[{"criterionId":number,"scoreValue":number,"comment":string}]}
- Include exactly one suggestion per provided criterionId.
- scoreValue must be between 0 and that criterion's maxScore (inclusive), prefer 0.5 steps.
- Comments: 1-3 sentences. Prefer English unless submission/rubric text is clearly Vietnamese.`;

    const userPayload = {
      event: input.eventName,
      round: input.roundName,
      track: input.trackName,
      submissionType: input.source,
      contextSummary: input.contextSummary,
      teamDescription: input.description || "",
      evidence: input.evidenceText,
      criteria: input.rubrics,
      instruction:
        input.source === "github_link"
          ? "Evidence includes repository files fetched from the contestant GitHub link plus recent commits. Score against rubrics using that code/docs evidence."
          : "Evidence includes extracted content from the contestant attachment (PDF/DOCX/PPTX/ZIP/text when readable). Score against rubrics using that document/code evidence.",
    };

    const parsed = await this.requestJsonCompletion({
      apiKey: input.apiKey,
      system,
      user: `Draft rubric scores for this submission.\n\n${JSON.stringify(userPayload)}`,
      temperature: 0.2,
    });

    return this.parseAndValidateSuggestions(
      JSON.stringify(parsed),
      input.rubrics,
    );
  }

  private parseAndValidateSuggestions(
    content: string,
    rubrics: CriterionContext[],
  ): AiScoreSuggestion[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new ServiceUnavailableException("AI returned invalid JSON.");
    }

    const rawList = Array.isArray(
      (parsed as { suggestions?: unknown }).suggestions,
    )
      ? (parsed as { suggestions: unknown[] }).suggestions
      : Array.isArray(parsed)
        ? (parsed as unknown[])
        : null;

    if (!rawList) {
      throw new ServiceUnavailableException(
        "AI response missing suggestions array.",
      );
    }

    const byId = new Map(rubrics.map((r) => [r.id, r]));
    const fromAi = new Map<number, AiScoreSuggestion>();

    for (const item of rawList) {
      if (!item || typeof item !== "object") continue;
      const row = item as {
        criterionId?: unknown;
        scoreValue?: unknown;
        comment?: unknown;
      };
      const criterionId = Number(row.criterionId);
      const rubric = byId.get(criterionId);
      if (!rubric) continue;

      let scoreValue = Number(row.scoreValue);
      if (!Number.isFinite(scoreValue)) scoreValue = 0;
      scoreValue = Math.max(0, Math.min(rubric.maxScore, scoreValue));
      scoreValue = Math.round(scoreValue * 2) / 2;
      scoreValue = Math.max(0, Math.min(rubric.maxScore, scoreValue));

      const comment =
        typeof row.comment === "string" && row.comment.trim()
          ? row.comment.trim().slice(0, 1000)
          : "Suggested from available evidence.";

      fromAi.set(criterionId, { criterionId, scoreValue, comment });
    }

    return rubrics.map((r) => {
      const existing = fromAi.get(r.id);
      if (existing) return existing;
      const mid = Math.round((r.maxScore / 2) * 2) / 2;
      return {
        criterionId: r.id,
        scoreValue: mid,
        comment:
          "Insufficient structured evidence in AI context; mid-range placeholder — please review manually.",
      };
    });
  }

  private truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return `${text.slice(0, max)}\n...[truncated]`;
  }
}
