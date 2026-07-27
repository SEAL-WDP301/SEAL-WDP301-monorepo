import { axiosClient } from '../axios';

export interface UploadResponse {
  success: boolean;
  data: {
    fileUrl: string;
    fileKey: string;
  };
}

export const uploadFile = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axiosClient.post('/storage/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};
