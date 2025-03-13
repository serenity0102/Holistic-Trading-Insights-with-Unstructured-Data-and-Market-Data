export interface ApiResponse<T> {
  data: T
  meta?: {
    fetchedAt: string
  }
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export interface PaginationParams {
  nextToken?: string
  limit?: number
} 