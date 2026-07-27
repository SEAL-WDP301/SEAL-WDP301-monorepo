"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getMentorProfile, updateMentorProfile } from "@/lib/api/mentor.api";

import { MentorPageHeader } from "@/app/mentor/_components/mentor-page-header";
import { MentorErrorState, MentorLoadingState } from "@/app/mentor/_components/mentor-query-state";

export default function MentorSettingsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["mentorProfile"], queryFn: getMentorProfile });
  const [form, setForm] = useState({ jobTitle: "", organization: "", experience: "", achievements: "", bio: "" });

  useEffect(() => {
    if (!query.data) return;
    const profile = query.data.stakeholderProfile;
    // Initialize the editable form after the profile query resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      jobTitle: profile?.jobTitle || "",
      organization: profile?.organization || profile?.organizationName || "",
      experience: profile?.experience || "",
      achievements: profile?.achievements || "",
      bio: profile?.bio || "",
    });
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: updateMentorProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentorProfile"] });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      enqueueSnackbar("Profile updated successfully", { variant: "success" });
    },
    onError: () => enqueueSnackbar("Failed to update profile", { variant: "error" }),
  });

  if (query.isLoading) return <MentorLoadingState />;
  if (query.isError || !query.data) return <MentorErrorState />;

  const avatarUrl = query.data.avatarUrl || query.data.avatar_url || undefined;
  const initial = query.data.name?.charAt(0).toUpperCase() || "?";

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <MentorPageHeader title="Stakeholder Settings" subtitle="Update your stakeholder profile stored by the backend." />
      <GlassCard className="rounded-[24px] bg-card p-6">
        <div className="flex flex-col gap-6 md:flex-row">
          <Avatar className="h-24 w-24">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={query.data.name || "Mentor"} /> : null}
            <AvatarFallback className="text-2xl">{initial}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 gap-4 md:grid-cols-2">
            <Input value={query.data.name || ""} disabled aria-label="Name" />
            <Input value={query.data.email} disabled aria-label="Email" />
            {(["jobTitle", "organization", "experience", "achievements"] as const).map((field) => (
              <Input
                key={field}
                value={form[field]}
                placeholder={field}
                onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
              />
            ))}
            <Textarea
              value={form.bio}
              placeholder="Biography"
              className="min-h-32 md:col-span-2"
              onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
            />
            <Button
              variant="orange"
              className="md:col-span-2"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(form)}
            >
              {mutation.isPending ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
