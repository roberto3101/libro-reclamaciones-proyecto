package dto

// PaginationRequest parámetros de paginación del query string.
type PaginationRequest struct {
	Page    int `json:"page"`
	PerPage int `json:"per_page"`
}

// Offset calcula el offset SQL.
func (p PaginationRequest) Offset() int {
	return (p.Page - 1) * p.PerPage
}

// Limit retorna el per_page para SQL LIMIT.
func (p PaginationRequest) Limit() int {
	return p.PerPage
}

// PaginatedResponse respuesta paginada genérica.
type PaginatedResponse[T any] struct {
	Data       []T  `json:"data"`
	Total      int  `json:"total"`
	Page       int  `json:"page"`
	PerPage    int  `json:"per_page"`
	TotalPages int  `json:"total_pages"`
	HasNext    bool `json:"has_next"`
}

// NewPaginatedResponse crea una respuesta paginada.
func NewPaginatedResponse[T any](data []T, total, page, perPage int) PaginatedResponse[T] {
	totalPages := total / perPage
	if total%perPage > 0 {
		totalPages++
	}
	return PaginatedResponse[T]{
		Data:       data,
		Total:      total,
		Page:       page,
		PerPage:    perPage,
		TotalPages: totalPages,
		HasNext:    page < totalPages,
	}
}
