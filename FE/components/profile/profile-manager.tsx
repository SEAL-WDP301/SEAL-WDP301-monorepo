"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { Suspense, useEffect, useMemo, useState } from "react";
import type * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { enqueueSnackbar } from "notistack";
import {
  Award,
  BriefcaseBusiness,
  GraduationCap,
  Loader2,
  Mail,
  Phone,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";

import { axiosClient } from "@/lib/axios";
import { queryKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/lib/stores/auth.store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ProfileHistory } from "./profile-history";

type RoleProfileMode = "student" | "professional" | "auto";

interface ProfileManagerProps {
  mode?: RoleProfileMode;
  title?: string;
  subtitle?: string;
}

interface StudentProfile {
  studentType?: "fpt" | "external" | string | null;
  studentCode?: string | null;
  universityName?: string | null;
  phone?: string | null;
  githubUsername?: string | null;
}

interface StakeholderProfile {
  jobTitle?: string | null;
  organization?: string | null;
  organizationName?: string | null;
  experience?: string | null;
  achievements?: string | null;
  bio?: string | null;
}

interface UserProfile {
  id?: number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  studentProfile?: StudentProfile | null;
  stakeholderProfile?: StakeholderProfile | null;
  profile?: StakeholderProfile | null;
}

interface StudentFormState {
  studentType: "fpt" | "external";
  studentCode: string;
  universityName: string;
  phone: string;
  githubUsername: string;
}

interface ProfessionalFormState {
  jobTitle: string;
  organization: string;
  experience: string;
  achievements: string;
  bio: string;
}

const emptyStudentForm: StudentFormState = {
  studentType: "fpt",
  studentCode: "",
  universityName: "FPT University",
  phone: "",
  githubUsername: "",
};

const emptyProfessionalForm: ProfessionalFormState = {
  jobTitle: "",
  organization: "",
  experience: "",
  achievements: "",
  bio: "",
};

function getInitials(name?: string | null) {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError(error)) return error.response?.data?.message || fallback;
  return fallback;
}

async function fetchUserProfile() {
  const res = await axiosClient.get("/users/profile");
  const user = res.data?.data as UserProfile | null;
  return user ? { ...user, avatarUrl: user.avatarUrl ?? user.avatar_url } : null;
}

export function ProfileManager(props: ProfileManagerProps) {
  return (
    <Suspense fallback={
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    }>
      <ProfileManagerContent {...props} />
    </Suspense>
  );
}

function ProfileManagerContent({
  mode = "auto",
  title = "Profile",
  subtitle = "Manage the profile information used across SEAL.",
}: ProfileManagerProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentTab = searchParams.get("tab") === "history" ? "history" : "info";

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`?${params.toString()}`);
  };

  const queryClient = useQueryClient();
  const [studentForm, setStudentForm] = useState<StudentFormState>(emptyStudentForm);
  const [professionalForm, setProfessionalForm] =
    useState<ProfessionalFormState>(emptyProfessionalForm);

  const storeUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const { data: user, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.user,
    queryFn: async () => {
      const data = await fetchUserProfile();
      if (data) setUser(data);
      return data;
    },
    refetchOnMount: "always",
  });

  const resolvedMode = useMemo(() => {
    if (mode !== "auto") return mode;
    return user?.role?.toLowerCase() === "student" ? "student" : "professional";
  }, [mode, user?.role]);

  const professionalProfile = user?.stakeholderProfile ?? user?.profile ?? null;

  useEffect(() => {
    if (!user) return;

    if (resolvedMode === "student") {
      const profile = user.studentProfile;
      setStudentForm({
        studentType: profile?.studentType === "external" ? "external" : "fpt",
        studentCode: profile?.studentCode || "",
        universityName: profile?.universityName || "FPT University",
        phone: profile?.phone || "",
        githubUsername: profile?.githubUsername || "",
      });
      return;
    }

    setProfessionalForm({
      jobTitle: professionalProfile?.jobTitle || "",
      organization:
        professionalProfile?.organization || professionalProfile?.organizationName || "",
      experience: professionalProfile?.experience || "",
      achievements: professionalProfile?.achievements || "",
      bio: professionalProfile?.bio || "",
    });
  }, [professionalProfile, resolvedMode, user]);

  const saveStudentMutation = useMutation({
    mutationFn: async (payload: StudentFormState) => {
      const res = await axiosClient.put("/users/profile/student", {
        ...payload,
        universityName:
          payload.studentType === "fpt" ? "FPT University" : payload.universityName,
      });
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
      enqueueSnackbar("Student profile saved.", { variant: "success" });
    },
    onError: (error) => {
      enqueueSnackbar(getErrorMessage(error, "Failed to save student profile."), {
        variant: "error",
      });
    },
  });

  const saveProfessionalMutation = useMutation({
    mutationFn: async (payload: ProfessionalFormState) => {
      const res = await axiosClient.put("/users/profile/stakeholder", payload);
      return res.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
      queryClient.invalidateQueries({ queryKey: ["mentorProfile"] });
      enqueueSnackbar("Professional profile saved.", { variant: "success" });
    },
    onError: (error) => {
      enqueueSnackbar(getErrorMessage(error, "Failed to save professional profile."), {
        variant: "error",
      });
    },
  });

  const isSaving = saveStudentMutation.isPending || saveProfessionalMutation.isPending;
  const avatarUrl = typeof user?.avatarUrl === "string" ? user.avatarUrl.trim() : "";
  const hasProfile =
    resolvedMode === "student" ? Boolean(user?.studentProfile) : Boolean(professionalProfile);

  const completion = useMemo(() => {
    const values =
      resolvedMode === "student"
        ? [
            studentForm.studentType,
            studentForm.studentCode,
            studentForm.universityName,
            studentForm.phone,
            studentForm.githubUsername,
          ]
        : [
            professionalForm.jobTitle,
            professionalForm.organization,
            professionalForm.experience,
            professionalForm.achievements,
            professionalForm.bio,
          ];
    const done = values.filter((value) => String(value || "").trim()).length;
    return { done, total: values.length, percent: Math.round((done / values.length) * 100) };
  }, [professionalForm, resolvedMode, studentForm]);

  const handleStudentSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!studentForm.studentCode.trim()) {
      enqueueSnackbar("Student ID is required.", { variant: "warning" });
      return;
    }
    if (!studentForm.githubUsername.trim()) {
      enqueueSnackbar("GitHub username is required.", { variant: "warning" });
      return;
    }
    if (studentForm.studentType === "external" && !studentForm.universityName.trim()) {
      enqueueSnackbar("University name is required for external students.", {
        variant: "warning",
      });
      return;
    }
    saveStudentMutation.mutate(studentForm);
  };

  const handleProfessionalSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveProfessionalMutation.mutate(professionalForm);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="rounded-[22px] border border-orange-500/20 bg-card dark:bg-[#14100c] p-8">
        <h1 className="text-2xl font-semibold text-foreground dark:text-[#f5f2ec]">Profile unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground dark:text-[#a39c8f]">The profile API did not return user data.</p>
        <Button type="button" onClick={() => refetch()} className="mt-5">
          Retry
        </Button>
      </div>
    );
  }

  const roleLabel = user.role || (resolvedMode === "student" ? "student" : "stakeholder");

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm dark:bg-[#14100c] dark:border-[rgba(255,154,60,0.16)]">
      <div className="relative mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-5 dark:border-white/10">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-500">
              Profile
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground dark:text-[#f5f2ec]">
              {title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground dark:text-[#a39c8f]">
              {subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3 bg-muted/40 p-2.5 rounded-xl border border-border/50 shrink-0 dark:bg-black/30 dark:border-white/5">
            <div className="h-2 w-32 overflow-hidden rounded-full bg-muted dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-700"
                style={{ width: `${completion.percent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              <b className="text-foreground dark:text-[#f5f2ec]">{completion.done}/{completion.total}</b> completed
            </p>
          </div>
        </div>

        <Tabs value={currentTab} onValueChange={handleTabChange} className="mt-6">
          <TabsList className="mb-6 grid w-full max-w-[360px] grid-cols-2 bg-muted/60 dark:bg-[#1e1814] border border-border dark:border-[rgba(255,154,60,0.16)] p-1 rounded-xl">
            <TabsTrigger value="info" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-muted-foreground dark:text-zinc-300 data-[state=active]:font-bold rounded-lg transition-all">Profile Info</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-muted-foreground dark:text-zinc-300 data-[state=active]:font-bold rounded-lg transition-all">History & Awards</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[340px_1fr]">
              <ProfilePreviewCard
                user={user}
                avatarUrl={avatarUrl}
                roleLabel={roleLabel}
                hasProfile={hasProfile}
                resolvedMode={resolvedMode}
                studentForm={studentForm}
                professionalForm={professionalForm}
              />

              {resolvedMode === "student" ? (
                <StudentProfileForm
                  form={studentForm}
                  setForm={setStudentForm}
                  isSaving={isSaving}
                  onSubmit={handleStudentSubmit}
                  onRevert={() => refetch()}
                />
              ) : (
                <ProfessionalProfileForm
                  form={professionalForm}
                  setForm={setProfessionalForm}
                  isSaving={isSaving}
                  onSubmit={handleProfessionalSubmit}
                  onRevert={() => refetch()}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <ProfileHistory userId={user.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ProfilePreviewCard({
  user,
  avatarUrl,
  roleLabel,
  hasProfile,
  resolvedMode,
  studentForm,
  professionalForm,
}: {
  user: UserProfile;
  avatarUrl: string;
  roleLabel: string;
  hasProfile: boolean;
  resolvedMode: RoleProfileMode;
  studentForm: StudentFormState;
  professionalForm: ProfessionalFormState;
}) {
  const previewItems =
    resolvedMode === "student"
      ? [
          {
            icon: <GraduationCap className="h-4 w-4" />,
            label: "University",
            value: studentForm.universityName || "No university",
            tone: "a" as const,
          },
          {
            icon: <FaGithub className="h-4 w-4" />,
            label: "GitHub",
            value: studentForm.githubUsername || "No GitHub username",
            tone: "b" as const,
          },
          {
            icon: <Phone className="h-4 w-4" />,
            label: "Phone",
            value: studentForm.phone || "No phone",
            tone: "c" as const,
          },
        ]
      : [
          {
            icon: <BriefcaseBusiness className="h-4 w-4" />,
            label: "Title",
            value: professionalForm.jobTitle || "No title",
            tone: "a" as const,
          },
          {
            icon: <ShieldCheck className="h-4 w-4" />,
            label: "Organization",
            value: professionalForm.organization || "No organization",
            tone: "b" as const,
          },
          {
            icon: <Award className="h-4 w-4" />,
            label: "Experience",
            value: professionalForm.experience || "No experience",
            tone: "c" as const,
          },
        ];

  return (
    <aside className="overflow-hidden rounded-[22px] border border-border dark:border-[rgba(255,154,60,0.16)] bg-card dark:bg-[#14100c] transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(255,154,60,0.34)] hover:shadow-[0_24px_60px_-24px_rgba(255,122,26,0.25)]">
      <div className="relative h-[84px] overflow-hidden bg-[linear-gradient(120deg,#3a2010,#1a1108_40%,#2a1810)] before:absolute before:inset-[-40%] before:animate-[profile-spin_8s_linear_infinite] before:bg-[conic-gradient(from_0deg,transparent,rgba(255,154,60,0.35),transparent_30%)]" />

      <div className="relative -mt-[46px] px-7 pb-6 text-center">
        <span className="absolute -top-[70px] right-5 inline-flex items-center gap-1.5 rounded-full border border-[rgba(107,217,122,0.35)] bg-[rgba(107,217,122,0.14)] px-3 py-1 text-xs font-semibold text-[#6bd97a] backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6bd97a] shadow-[0_0_6px_#6bd97a]" />
          Active
        </span>

        <div className="relative mx-auto mb-4 h-[92px] w-[92px]">
          <Avatar className="h-full w-full border-4 border-card transition-transform duration-300 hover:scale-105 dark:border-[#14100c]">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={user.name || "User"} /> : null}
            <AvatarFallback className="text-2xl font-black">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
        </div>

        <h2 className="text-xl font-bold">{user.name || "Unnamed user"}</h2>
        <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground dark:text-[#6f685c]">
          <Mail className="h-3.5 w-3.5" />
          <span className="max-w-[230px] truncate">{user.email || "No email"}</span>
        </div>

        <div className="mt-4 flex justify-center gap-2">
          <span className="rounded-full border border-[rgba(255,154,60,0.3)] bg-[rgba(255,154,60,0.14)] px-3 py-1.5 text-xs font-semibold capitalize text-[#ff9a3c]">
            {roleLabel}
          </span>
          <span className="rounded-full border border-border dark:border-[rgba(255,154,60,0.16)] bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-muted-foreground dark:text-[#a39c8f]">
            {hasProfile ? "Profile ready" : "Create profile"}
          </span>
        </div>
      </div>

      <div className="border-t border-border dark:border-[rgba(255,154,60,0.16)] p-2">
        {previewItems.map((item) => (
          <InfoRow key={item.label} {...item} />
        ))}
      </div>
    </aside>
  );
}

function StudentProfileForm({
  form,
  setForm,
  isSaving,
  onSubmit,
  onRevert,
}: {
  form: StudentFormState;
  setForm: React.Dispatch<React.SetStateAction<StudentFormState>>;
  isSaving: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onRevert: () => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[22px] border border-border dark:border-[rgba(255,154,60,0.16)] bg-card dark:bg-[#14100c] p-6 transition-colors duration-300 hover:border-[rgba(255,154,60,0.25)] sm:p-8"
    >
      <FormHeader
        title="Student Information"
        description="Create or update your participant profile. Changes reflect on the left instantly."
        isSaving={isSaving}
        onRevert={onRevert}
      />

      <FormSection title="Identity">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Student type">
            <select
              value={form.studentType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  studentType: event.target.value as StudentFormState["studentType"],
                  universityName:
                    event.target.value === "fpt" ? "FPT University" : current.universityName,
                }))
              }
              className={inputClassName}
            >
              <option value="fpt">FPT University</option>
              <option value="external">Partner University</option>
            </select>
          </Field>

          <Field label="Student ID">
            <Input
              value={form.studentCode}
              onChange={(event) =>
                setForm((current) => ({ ...current, studentCode: event.target.value }))
              }
              placeholder="SE123456"
              className={inputClassName}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Contact">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="University">
            <Input
              value={form.universityName}
              disabled={form.studentType === "fpt"}
              onChange={(event) =>
                setForm((current) => ({ ...current, universityName: event.target.value }))
              }
              placeholder="University name"
              className={inputClassName}
            />
          </Field>

          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
              placeholder="0987654321"
              className={inputClassName}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Development">
        <Field label="GitHub username">
          <Input
            value={form.githubUsername}
            onChange={(event) =>
              setForm((current) => ({ ...current, githubUsername: event.target.value }))
            }
            placeholder="octocat"
            className={inputClassName}
          />
          <p className="mt-1.5 text-xs text-muted-foreground dark:text-[#6f685c]">
            Used to link your commits and pull requests to submissions.
          </p>
        </Field>
      </FormSection>
    </form>
  );
}

function ProfessionalProfileForm({
  form,
  setForm,
  isSaving,
  onSubmit,
  onRevert,
}: {
  form: ProfessionalFormState;
  setForm: React.Dispatch<React.SetStateAction<ProfessionalFormState>>;
  isSaving: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onRevert: () => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-[22px] border border-border dark:border-[rgba(255,154,60,0.16)] bg-card dark:bg-[#14100c] p-6 transition-colors duration-300 hover:border-[rgba(255,154,60,0.25)] sm:p-8"
    >
      <FormHeader
        title="Professional Information"
        description="Create or update your judging, mentoring, or organizer profile."
        isSaving={isSaving}
        onRevert={onRevert}
      />

      <FormSection title="Identity">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Job title">
            <Input
              value={form.jobTitle}
              onChange={(event) =>
                setForm((current) => ({ ...current, jobTitle: event.target.value }))
              }
              placeholder="Judge, Mentor, Organizer"
              className={inputClassName}
            />
          </Field>

          <Field label="Organization">
            <Input
              value={form.organization}
              onChange={(event) =>
                setForm((current) => ({ ...current, organization: event.target.value }))
              }
              placeholder="FPT University"
              className={inputClassName}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Background">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Experience">
            <Input
              value={form.experience}
              onChange={(event) =>
                setForm((current) => ({ ...current, experience: event.target.value }))
              }
              placeholder="5 years in software engineering"
              className={inputClassName}
            />
          </Field>

          <Field label="Achievements">
            <Input
              value={form.achievements}
              onChange={(event) =>
                setForm((current) => ({ ...current, achievements: event.target.value }))
              }
              placeholder="Awards, publications, notable projects"
              className={inputClassName}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Bio">
        <Field label="Short bio">
          <Textarea
            value={form.bio}
            onChange={(event) =>
              setForm((current) => ({ ...current, bio: event.target.value }))
            }
            placeholder="Short public bio"
            className={cn(inputClassName, "min-h-28 resize-y")}
          />
        </Field>
      </FormSection>
    </form>
  );
}

function FormHeader({
  title,
  description,
  isSaving,
  onRevert,
}: {
  title: string;
  description: string;
  isSaving: boolean;
  onRevert: () => void;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-xl font-bold text-foreground dark:text-[#f5f2ec]">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground dark:text-[#a39c8f]">{description}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRevert}
          disabled={isSaving}
          className="border-border dark:border-[rgba(255,154,60,0.16)] bg-transparent text-muted-foreground dark:text-[#a39c8f] hover:border-[#a39c8f] hover:bg-transparent hover:text-foreground dark:text-[#f5f2ec]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Revert
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isSaving}
          className="bg-[linear-gradient(145deg,#ff9a3c,#ff6a1a)] font-bold text-zinc-900 dark:text-[#1a0e04] shadow-[0_8px_20px_-10px_rgba(255,122,26,0.6)] hover:translate-y-[-1px]"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="mb-7 border-0">
      <legend className="mb-4 flex w-full items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-[#ff9a3c]">
        {title}
        <span className="h-px flex-1 bg-[linear-gradient(90deg,rgba(255,154,60,0.16),transparent)]" />
      </legend>
      {children}
    </fieldset>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-2 block text-xs font-semibold text-muted-foreground dark:text-[#6f685c]">{label}</Label>
      {children}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "a" | "b" | "c";
}) {
  const toneClass = {
    a: "bg-[rgba(255,154,60,0.14)] text-[#ff9a3c]",
    b: "bg-white/[0.06] text-muted-foreground dark:text-[#a39c8f]",
    c: "bg-[rgba(90,169,230,0.14)] text-[#7fc4f0]",
  }[tone];

  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 hover:translate-x-1 hover:bg-[rgba(255,154,60,0.05)]">
      <div className={cn("flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]", toneClass)}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground dark:text-[#6f685c]">
          {label}
        </div>
        <div className="truncate text-sm font-semibold text-foreground dark:text-[#f5f2ec]">{value}</div>
      </div>
    </div>
  );
}

const inputClassName =
  "mt-0 h-auto w-full rounded-[10px] border border-border dark:border-[rgba(255,154,60,0.16)] bg-background dark:bg-[#1a1410] px-3.5 py-3 text-[14.5px] text-foreground dark:text-[#f5f2ec] outline-none transition-colors placeholder:text-muted-foreground dark:text-[#6f685c] focus-visible:border-[#ff9a3c] focus-visible:ring-3 focus-visible:ring-[rgba(255,154,60,0.12)] disabled:opacity-70";
