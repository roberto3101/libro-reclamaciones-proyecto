package helper

import (
	"libro-reclamaciones/internal/model/dto"
	"strconv"

	"github.com/gin-gonic/gin"
)

const (
	defaultPage    = 1
	defaultPerPage = 20
	maxPerPage     = 100
)

// ParsePagination extrae page y per_page del query string con defaults seguros.
func ParsePagination(c *gin.Context) dto.PaginationRequest {
	page := parseIntParam(c, "page", defaultPage)
	perPage := parseIntParam(c, "per_page", defaultPerPage)

	if page < 1 {
		page = defaultPage
	}
	if perPage < 1 {
		perPage = defaultPerPage
	}
	if perPage > maxPerPage {
		perPage = maxPerPage
	}

	return dto.PaginationRequest{
		Page:    page,
		PerPage: perPage,
	}
}

func parseIntParam(c *gin.Context, key string, fallback int) int {
	val := c.Query(key)
	if val == "" {
		return fallback
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return fallback
	}
	return n
}
