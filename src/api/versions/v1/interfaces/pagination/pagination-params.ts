export interface PaginationParams {
  cursor?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: number;
}
