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
  const [hasChecked, setHasChecked] = useState(false);
  const setUser = useAuthStore((state) => state.setUser);
  const storeUser = useAuthStore((state) => state.user);

  // We only run this query if there is an access_token in state
  const hasToken = !!useAuthStore.getState().accessToken;

  const { data: user, isSuccess } = useQuery({
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
    initialData: storeUser ? { ...storeUser, avatarUrl: storeUser.avatarUrl ?? storeUser.avatar_url } : undefined,
    enabled: hasToken && !hasChecked,
    retry: false,
  });

  useEffect(() => {
    if (isSuccess && user) {
      // Skip check for admin and organizer roles
      if (user.role === 'admin' || user.role === 'organizer') {
        setHasChecked(true);
        return;
      }

      // Check if both profiles are missing
      if (!user.studentProfile && !user.stakeholderProfile) {
        setShowModal(true);
      }
      setHasChecked(true);
    }
  }, [isSuccess, user]);

  return (
    <>
      <ProfileCompletionModal isOpen={showModal} onOpenChange={setShowModal} />
    </>
  );
}
