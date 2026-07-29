/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosClient } from "@/lib/axios";
import { ProfileCompletionModal } from "./profile-completion-modal";
import { useAuthStore } from "@/lib/stores/auth.store";
import { queryKeys } from "@/lib/query-keys";

export function ProfileChecker() {
  const [showModal, setShowModal] = useState(false);
  const setUser = useAuthStore((state) => state.setUser);
  const accessToken = useAuthStore((state) => state.accessToken);

  const hasToken = !!accessToken;

  const { data: user, isSuccess, isFetching } = useQuery({
    queryKey: queryKeys.user,
    queryFn: async () => {
      const res = await axiosClient.get("/users/profile");
      const profile = res.data?.data;
      const normalized = profile
        ? { ...profile, avatarUrl: profile.avatarUrl ?? profile.avatar_url }
        : null;
      if (normalized) setUser(normalized);
      return normalized;
    },
    enabled: hasToken,
    retry: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (!isSuccess || isFetching) return;
    if (!user) return;

    if (user.role === "admin" || user.role === "organizer") {
      setShowModal(false);
      return;
    }

    const hasStudent = !!(user.studentProfile || (user as any).student_profile);
    const hasStakeholder = !!(user.stakeholderProfile || (user as any).stakeholder_profile);

    if (!hasStudent && !hasStakeholder) {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  }, [isSuccess, isFetching, user]);

  return (
    <>
      <ProfileCompletionModal isOpen={showModal} onOpenChange={setShowModal} />
    </>
  );
}
