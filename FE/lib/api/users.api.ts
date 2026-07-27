import { axiosClient } from "@/lib/axios";

export type UserRole = "admin" | "organizer" | "student" | "stakeholder" | "judge";

export interface UserAccount {
  id: number;
  name?: string | null;
  email: string;
  role: UserRole | string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  stakeholderProfile?: {
    organizationName?: string | null;
    jobTitle?: string | null;
  } | null;
}

function unwrapData<T>(response: { data?: { data?: T } }) {
  return response.data?.data as T;
}

export async function getUsers() {
  const res = await axiosClient.get("/users");
  return unwrapData<UserAccount[]>(res);
}

export async function updateUserRole(userId: string | number, role: UserRole) {
  const res = await axiosClient.patch(`/users/${userId}/role`, { role });
  return unwrapData<UserAccount>(res);
}
