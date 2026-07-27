import { axiosClient } from "../axios";

export interface TeamMessage {
  id: number;
  teamId: number;
  senderId: number;
  content: string;
  createdAt: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  sender: {
    id: number;
    name: string;
    avatarUrl: string;
    role: string;
  };
  reads?: {
    userId: number;
    readAt: string;
    user: {
      id: number;
      name: string;
      avatarUrl: string;
    }
  }[];
}

export const chatApi = {
  getTeamMessages: async (teamId: number, cursor?: number): Promise<TeamMessage[]> => {
    const res = await axiosClient.get(`/chat/teams/${teamId}/messages`, {
      params: { cursor }
    });
    return res.data.data;
  },
};
