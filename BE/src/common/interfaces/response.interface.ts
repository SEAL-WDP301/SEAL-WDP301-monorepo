/**
 * Unified API response interfaces.
 * All controller handlers should return these shapes (enforced by TransformInterceptor).
 */

export interface ISuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
  timestamp: string;
}

export interface IErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  errors?: string[];
  timestamp: string;
  path?: string;
}

/**
 * Helper type for paginated responses.
 */
export interface IPaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
