/**
 * Ceremony checklist for a Flow B event.
 * Run: node -r ts-node/register -r tsconfig-paths/register scripts/audit-ceremony-checklist.ts [eventId]
 */
import * as dotenv from "dotenv";
import * as path from "path";
import { PrismaClient, RoundStatus, TeamStatus } from "@prisma/client";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();
const eventId = parseInt(process.argv[2] || "66", 10);

type Step = {
  id: string;
  label: string;
  done: boolean;
  detail: string;
  optional?: boolean;
};

async function main() {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      tracks: { orderBy: { id: "asc" } },
      problemPoolItems: { orderBy: { id: "asc" } },
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: {
          trackProblems: {
            include: { track: { select: { id: true, name: true } } },
            orderBy: { trackId: "asc" },
          },
        },
      },
    },
  });

  if (!event) {
    console.error(`Event #${eventId} not found`);
    process.exit(1);
  }

  const teams = await prisma.team.findMany({
    where: { eventId },
    select: {
      id: true,
      name: true,
      status: true,
      trackId: true,
      track: { select: { name: true } },
    },
    orderBy: { id: "asc" },
  });

  const approved = teams.filter((t) => t.status === TeamStatus.approved);
  const pending = teams.filter((t) => t.status === TeamStatus.pending);
  const approvedNoTrack = approved.filter((t) => t.trackId == null);
  const approvedWithTrack = approved.filter((t) => t.trackId != null);

  const ceremonyRound =
    event.rounds.find(
      (r) =>
        r.status === RoundStatus.not_started && r.trackProblems.length > 0,
    ) ?? event.rounds.find((r) => r.status === RoundStatus.not_started);

  const trackCount = ceremonyRound?.trackProblems.length ?? 0;
  const unassignedPool = event.problemPoolItems.filter(
    (p) => p.assignedRoundId == null,
  );
  const problemsReady =
    ceremonyRound?.trackProblems.every((tp) => tp.problemFileUrl?.trim()) ??
    false;

  const steps: Step[] = [
    {
      id: "flow-b",
      label: "Event bật Flow B (deferred track assignment)",
      done: event.deferredTrackAssignment,
      detail: event.deferredTrackAssignment ? "Đã bật" : "Cần tạo/sửa event Flow B",
    },
    {
      id: "published",
      label: "Event published / mở đăng ký",
      done: event.status !== "draft" || Boolean(event.registrationDeadline),
      detail: `status=${event.status}, deadline=${event.registrationDeadline?.toISOString() ?? "—"}`,
      optional: true,
    },
    {
      id: "teams-exist",
      label: "Có đội đăng ký",
      done: teams.length > 0,
      detail: `${teams.length} đội (${approved.length} approved, ${pending.length} pending)`,
    },
    {
      id: "teams-approved",
      label: "Đội đã approved (auto khi đủ thành viên accepted ≥ min)",
      done: teams.length > 0 && pending.length === 0,
      detail:
        pending.length > 0
          ? `Còn ${pending.length} đội pending — chưa đủ thành viên accepted hoặc chờ BTC duyệt`
          : `Tất cả ${approved.length} đội đã approved`,
    },
    {
      id: "catalog-tracks",
      label: "Catalog bảng (Tracks) trong event",
      done: event.tracks.length > 0,
      detail: event.tracks.map((t) => t.name).join(", ") || "Chưa có bảng",
    },
    {
      id: "round-tracks",
      label: "Gắn bảng vào round ceremony (not_started)",
      done: trackCount > 0,
      detail: ceremonyRound
        ? `Round "${ceremonyRound.name}": ${trackCount} bảng`
        : "Chưa có round not_started với bảng",
    },
    {
      id: "pool-upload",
      label: "Upload Pool đề (≥ số bảng)",
      done: event.problemPoolItems.length >= trackCount && trackCount > 0,
      detail: `${event.problemPoolItems.length} đề trong pool, cần ≥ ${trackCount}`,
    },
    {
      id: "phase-1",
      label: "Phase 1 — Random Track (bốc đề → bảng)",
      done: problemsReady && trackCount > 0,
      detail: ceremonyRound
        ? `${ceremonyRound.trackProblems.filter((tp) => tp.problemFileUrl?.trim()).length}/${trackCount} bảng có đề`
        : "—",
    },
    {
      id: "phase-2",
      label: "Phase 2 — Bốc thăm đội → bảng",
      done: approved.length > 0 && approvedNoTrack.length === 0,
      detail:
        approved.length === 0
          ? "Chưa có đội approved"
          : approvedNoTrack.length > 0
            ? `Còn ${approvedNoTrack.length} đội chưa có bảng — cần chạy Phase 2`
            : `Tất cả ${approvedWithTrack.length} đội đã có bảng`,
    },
    {
      id: "open-round",
      label: "Mở round (Open)",
      done: ceremonyRound?.status === RoundStatus.open,
      detail: ceremonyRound
        ? `Round "${ceremonyRound.name}" = ${ceremonyRound.status}`
        : "—",
      optional: true,
    },
  ];

  console.log(`\n=== Ceremony checklist — Event #${event.id} "${event.name}" ===\n`);

  for (const s of steps) {
    const mark = s.done ? "✓" : s.optional ? "○" : "✗";
    console.log(`${mark} ${s.label}`);
    console.log(`    ${s.detail}`);
  }

  const required = steps.filter((s) => !s.optional);
  const doneRequired = required.filter((s) => s.done).length;
  console.log(`\nTiến độ: ${doneRequired}/${required.length} bước bắt buộc`);

  const next = required.find((s) => !s.done);
  if (next) {
    console.log(`\n→ Bước tiếp theo: ${next.label}`);
  } else {
    console.log("\n→ Ceremony xong — có thể mở round cho SV làm bài.");
  }

  if (approvedWithTrack.length > 0) {
    console.log("\n--- Đội đã gán bảng ---");
    for (const t of approvedWithTrack) {
      console.log(`  ${t.name} → ${t.track?.name ?? t.trackId}`);
    }
  }

  if (ceremonyRound && problemsReady) {
    console.log("\n--- Đề đã gán bảng ---");
    for (const tp of ceremonyRound.trackProblems) {
      const pool = event.problemPoolItems.find(
        (p) => p.assignedTrackId === tp.trackId,
      );
      console.log(
        `  ${tp.track.name} ← ${pool?.label ?? tp.problemFileUrl?.slice(0, 40) ?? "?"}`,
      );
    }
  }

  console.log("");
  await prisma.$disconnect();
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
