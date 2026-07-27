import { axiosClient } from "../axios";

export const workspaceApi = {
  getWorkspaceOverview: async (eventId: number) => {
    const response = await axiosClient.get(`/student/teams/my-team/workspace`, {
      params: { eventId },
    });
    return response.data;
  },

  submitProject: async (formData: FormData) => {
    const response = await axiosClient.post(
      `/student/teams/my-team/submissions`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },
};
