import { axiosClient } from "@/lib/axios";

export interface StudentOnlineMeeting {
  eventId: number;
  platform: string;
  meetUrl: string;
  startDate?: string | null;
  endDate?: string | null;
}

export async function getStudentOnlineMeeting(eventId: string | number) {
  const response = await axiosClient.get<{ data: StudentOnlineMeeting }>(
    `/student/events/${eventId}/online-meeting`,
  );
  return response.data.data;
}
