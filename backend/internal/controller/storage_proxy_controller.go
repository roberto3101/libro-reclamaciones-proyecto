package controller

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// StorageProxyController reenvía peticiones al microservicio de almacenamiento,
// inyectando la API key en el header para que el frontend no la exponga.
type StorageProxyController struct {
	proxy  *httputil.ReverseProxy
	apiKey string
}

func NewStorageProxyController(targetURL, apiKey string) *StorageProxyController {
	target, _ := url.Parse(strings.TrimRight(targetURL, "/"))

	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.Transport = &http.Transport{
		TLSClientConfig:       &tls.Config{MinVersion: tls.VersionTLS12},
		ResponseHeaderTimeout: 60 * time.Second,
		DisableKeepAlives:     true, // Conexión nueva por cada request — evita problemas de TLS renegotiation
	}

	// El microservicio agrega sus propios headers CORS (Access-Control-Allow-*).
	// El middleware CORS del backend Go también los agrega, lo que produce
	// "header contains multiple values" en el navegador. Limpiamos los del upstream.
	proxy.ModifyResponse = func(resp *http.Response) error {
		resp.Header.Del("Access-Control-Allow-Origin")
		resp.Header.Del("Access-Control-Allow-Credentials")
		resp.Header.Del("Access-Control-Allow-Methods")
		resp.Header.Del("Access-Control-Allow-Headers")
		resp.Header.Del("Access-Control-Expose-Headers")
		resp.Header.Del("Access-Control-Max-Age")
		return nil
	}

	// Log de errores del proxy
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		fmt.Printf("[ERROR] storage-proxy: %s %s -> %v\n", r.Method, r.URL.Path, err)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusBadGateway)
		w.Write([]byte(`{"exito":false,"mensaje":"Error al conectar con el servicio de almacenamiento"}`))
	}

	return &StorageProxyController{
		proxy:  proxy,
		apiKey: apiKey,
	}
}

// Proxy reenvía la petición al microservicio de almacenamiento.
func (s *StorageProxyController) Proxy(c *gin.Context) {
	// Reescribir path: /storage-api/almacenamiento/subir -> /almacenamiento/subir
	c.Request.URL.Path = c.Param("proxyPath")

	// Inyectar API key y limpiar headers que no deben llegar
	c.Request.Header.Set("X-API-Key", s.apiKey)
	c.Request.Header.Del("Cookie")

	s.proxy.ServeHTTP(c.Writer, c.Request)
}
