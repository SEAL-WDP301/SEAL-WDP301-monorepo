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

  // We only run this query if there is an access_token in state
  const hasToken = !!useAuthStore.getState().accessToken;

  // Always fetch fresh from API — do NOT use initialData (stale sessionStorage)
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
    staleTime: 0, // always re-fetch fresh
  });

  useEffect(() => {
    // Wait until fetch is done (not still loading)
    if (!isSuccess || isFetching) return;
    if (!user) return;

    // Skip check for admin and organizer roles
    if (user.role === 'admin' || user.role === 'organizer') return;

    // Only show modal if BOTH profiles are missing
    if (!user.studentProfile && !user.stakeholderProfile) {
      setShowModal(true);
    }
  }, [isSuccess, isFetching, user]);

  return (
    <>
      <ProfileCompletionModal isOpen={showModal} onOpenChange={setShowModal} />
    </>
  );
}
