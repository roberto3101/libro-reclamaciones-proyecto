// ── Respuesta genérica del backend ──
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

// ── Paginación ──
export interface PaginationRequest {
  page: number;
  per_page: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ── Nullable helpers (mirror Go NullString, NullUUID, etc.) ──
export type Nullable<T> = T | null;