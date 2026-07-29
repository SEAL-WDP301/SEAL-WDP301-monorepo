import { axiosClient } from "@/lib/axios";

export interface RunE2eScriptResponse {
  success: boolean;
  message: string;
  output: string;
}

export async function runE2eScriptApi(scriptKey: string, eventId?: number): Promise<RunE2eScriptResponse> {
  const res = await axiosClient.post<RunE2eScriptResponse>("/dev-e2e/run-script", {
    scriptKey,
    eventId: eventId ? Number(eventId) : undefined,
  });
  return res.data;
}
