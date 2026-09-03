package helper

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestGetClientIP_CFConnectingIP(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name       string
		headers    map[string]string
		remoteAddr string
		wantIP     string
	}{
		{
			name:       "usa CF-Connecting-IP cuando está presente",
			headers:    map[string]string{"CF-Connecting-IP": "190.50.10.1"},
			remoteAddr: "172.16.0.1:1234",
			wantIP:     "190.50.10.1",
		},
		{
			name:       "fallback a RemoteAddr cuando no hay CF header",
			headers:    map[string]string{},
			remoteAddr: "200.60.20.5:1234",
			wantIP:     "200.60.20.5",
		},
		{
			name: "CF-Connecting-IP tiene prioridad sobre X-Forwarded-For",
			headers: map[string]string{
				"CF-Connecting-IP": "190.50.10.1",
				"X-Forwarded-For":  "10.0.0.1",
			},
			remoteAddr: "172.16.0.1:1234",
			wantIP:     "190.50.10.1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Request = &http.Request{
				Header:     http.Header{},
				RemoteAddr: tt.remoteAddr,
			}
			for k, v := range tt.headers {
				c.Request.Header.Set(k, v)
			}

			got := GetClientIP(c)
			if got != tt.wantIP {
				t.Errorf("GetClientIP() = %q, want %q", got, tt.wantIP)
			}
		})
	}
}
