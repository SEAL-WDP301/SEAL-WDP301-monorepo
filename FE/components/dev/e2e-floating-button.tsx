"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { axiosClient } from "@/lib/axios";
import { runE2eScriptApi } from "@/lib/api/dev-e2e.api";
import { useAuthStore } from "@/lib/stores/auth.store";
import { enqueueSnackbar } from "notistack";
import {
  FlaskConical,
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CalendarPlus,
  Users,
  UserCheck,
  FileSpreadsheet,
  FileUp,
  Award,
  TrendingUp,
  Terminal,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface E2eScriptItem {
  key: string;
  number: string;
  title: string;
  description: string;
  icon: any;
}

const E2E_SCRIPTS: E2eScriptItem[] = [
  { key: "01-create-event", number: "01", title: "Create Event & Tracks", description: "Tạo Event mới kèm 2 Tracks & 2 Rounds", icon: CalendarPlus },
  { key: "02-create-teams", number: "02", title: "Create Teams & Members", description: "Tạo 10 đội thi & thêm thành viên sinh viên", icon: Users },
  { key: "03-assign-judges", number: "03", title: "Assign Judges & Mentors", description: "Phân công Giám khảo & Mentor vào các Vòng", icon: UserCheck },
  { key: "04-generate-rubrics", number: "04", title: "Generate Rubrics", description: "Khởi tạo bảng điểm & tiêu chí đánh giá", icon: FileSpreadsheet },
  { key: "05-create-submissions", number: "05", title: "Create Submissions (R1)", description: "Nộp bài tự động cho Vòng sơ loại (Round 1)", icon: FileUp },
  { key: "06-score-round1", number: "06", title: "Score Round 1", description: "Giám khảo chấm điểm tự động cho Vòng 1", icon: Award },
  { key: "07-advance-to-round2", number: "07", title: "Advance to Round 2", description: "Duyệt và chuyển các Đội thi trúng tuyển vào Vòng 2", icon: TrendingUp },
  { key: "08-create-submissions-round2", number: "08", title: "Create Submissions (R2)", description: "Nộp dự án tự động cho Vòng chung kết (Round 2)", icon: FileUp },
  { key: "09-score-round2", number: "09", title: "Score Round 2", description: "Giám khảo chấm điểm chung kết & tổng kết giải", icon: Award },
];

export function E2eFloatingButton({ eventId }: { eventId?: string | number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [runningScriptKey, setRunningScriptKey] = useState<string | null>(null);
  const [scriptStatuses, setScriptStatuses] = useState<Record<string, "success" | "error" | "idle">>({});
  const [activeLog, setActiveLog] = useState<{ title: string; output: string } | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);

  const queryClient = useQueryClient();

  // Fetch logged in user profile
  const { data: user } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const token = useAuthStore.getState().accessToken;
      if (!token) return null;
      const res = await axiosClient.get("/users/profile");
      return res.data?.data || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Strict role check: ONLY show for Admin
  if (!user || user.role !== "admin") {
    return null;
  }

  const parsedEventId = eventId ? Number(eventId) : undefined;

  const handleRunScript = async (script: E2eScriptItem) => {
    if (runningScriptKey) return; // Prevent concurrent script executions

    setRunningScriptKey(script.key);
    try {
      const result = await runE2eScriptApi(script.key, parsedEventId);
      if (result.success) {
        setScriptStatuses((prev) => ({ ...prev, [script.key]: "success" }));
        enqueueSnackbar(`✅ ${result.message}`, { variant: "success" });
        
        // Refresh all event queries in workspace
        queryClient.invalidateQueries();
      } else {
        setScriptStatuses((prev) => ({ ...prev, [script.key]: "error" }));
        enqueueSnackbar(`❌ ${result.message}`, { variant: "error" });
      }

      if (result.output) {
        setActiveLog({ title: script.title, output: result.output });
      }
    } catch (err: any) {
      console.error("E2E script error:", err);
      setScriptStatuses((prev) => ({ ...prev, [script.key]: "error" }));
      const errorMsg = err?.response?.data?.message || err.message || "Failed to execute script";
      enqueueSnackbar(`❌ ${errorMsg}`, { variant: "error" });
    } finally {
      setRunningScriptKey(null);
    }
  };

  return (
    <>
      {/* Floating Action Button (Bottom Left) */}
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "relative h-12 w-12 rounded-full flex items-center justify-center text-white font-bold transition-all shadow-xl backdrop-blur-md border",
            isOpen
              ? "bg-slate-900 border-amber-500/50 shadow-amber-500/20"
              : "bg-slate-950/90 border-slate-700/80 hover:border-slate-500 shadow-black/50"
          )}
          title="Admin E2E Test Suite"
        >
          {/* Subtle Outer Glow */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-500/20 via-blue-500/20 to-purple-500/20 animate-pulse pointer-events-none" />

          {/* Floating Badge */}
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-extrabold text-black ring-2 ring-slate-950">
            E2E
          </span>

          <FlaskConical className={cn("h-5 w-5 transition-transform duration-300", isOpen && "rotate-45 text-amber-400")} />
        </motion.button>

        {/* Dropdown Menu Panel */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-16 left-0 w-80 sm:w-96 rounded-2xl border border-slate-800 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl text-slate-100 ring-1 ring-white/10"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-amber-500/10 p-1.5 text-amber-400 border border-amber-500/20">
                    <FlaskConical className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Admin E2E Tester</h4>
                    <p className="text-[11px] text-slate-400">
                      {parsedEventId ? `Target Event ID: #${parsedEventId}` : "Auto-select Active Event"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Script Buttons Grid */}
              <div className="max-h-[380px] space-y-1.5 overflow-y-auto pr-1 text-xs">
                {E2E_SCRIPTS.map((script) => {
                  const isRunning = runningScriptKey === script.key;
                  const status = scriptStatuses[script.key] || "idle";
                  const Icon = script.icon;

                  return (
                    <button
                      key={script.key}
                      disabled={!!runningScriptKey}
                      onClick={() => handleRunScript(script)}
                      className={cn(
                        "w-full flex items-center justify-between rounded-xl p-2.5 text-left transition-all border group",
                        isRunning
                          ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                          : status === "success"
                            ? "bg-slate-900/60 border-emerald-500/30 hover:border-emerald-500/60 text-slate-200"
                            : status === "error"
                              ? "bg-slate-900/60 border-red-500/30 hover:border-red-500/60 text-slate-200"
                              : "bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700 text-slate-300"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-[11px] font-bold text-amber-400 border border-slate-700">
                          {script.number}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold truncate text-slate-100 flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-400 transition-colors shrink-0" />
                            <span className="truncate">{script.title}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{script.description}</p>
                        </div>
                      </div>

                      {/* Status Icon */}
                      <div className="shrink-0 ml-2">
                        {isRunning ? (
                          <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                        ) : status === "success" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : status === "error" ? (
                          <AlertCircle className="h-4 w-4 text-red-400" />
                        ) : (
                          <Play className="h-3.5 w-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Log View Trigger */}
              {activeLog && (
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 truncate max-w-[200px]">Log: {activeLog.title}</span>
                  <button
                    onClick={() => setShowLogModal(true)}
                    className="flex items-center gap-1 text-amber-400 hover:underline font-medium"
                  >
                    <Terminal className="h-3 w-3" /> View Log Output
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Log Detail Modal */}
      {showLogModal && activeLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <h3 className="font-semibold text-amber-400 flex items-center gap-2">
                <Terminal className="h-4 w-4" /> Execution Log: {activeLog.title}
              </h3>
              <button
                onClick={() => setShowLogModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-xl bg-slate-900/90 p-4 text-xs font-mono text-emerald-400 whitespace-pre-wrap border border-slate-800">
              {activeLog.output}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
