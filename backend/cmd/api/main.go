package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	_ "net/http/pprof"
	"os"
	"os/signal"
	"syscall"
	"time"

	"libro-reclamaciones/internal/config"
	"libro-reclamaciones/internal/db"
	"libro-reclamaciones/internal/middleware"
	"libro-reclamaciones/internal/router"
	ws "libro-reclamaciones/internal/websocket"

	"github.com/gin-gonic/gin"
)

func main() {
	// 1. Cargar configuración
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Error cargando configuración: %v", err)
	}

	// 2. Conectar a CockroachDB
	cockroach, err := db.NewCockroachDB(cfg.Cockroach)
	if err != nil {
		log.Fatalf("Error conectando a CockroachDB: %v", err)
	}
	defer cockroach.Close()
	log.Printf("✓ CockroachDB conectado: %s:%s/%s",
		cfg.Cockroach.Host, cfg.Cockroach.Port, cfg.Cockroach.DBName)

	// 3. Configurar Gin
	if !cfg.Server.IsDevelopment() {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()

	// 4. Middlewares globales
	r.Use(middleware.RecoveryMiddleware())
	r.Use(middleware.SecurityHeadersMiddleware())
	r.Use(middleware.LoggerMiddleware())
	r.Use(middleware.CORSMiddleware(cfg.CORS))

	// 5. Health check
	r.GET("/health", func(c *gin.Context) {
		if err := cockroach.Health(c.Request.Context()); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status": "unhealthy",
				"db":     err.Error(),
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "db": "connected"})
	})

	// 6. Servidor interno de diagnóstico (pprof) — solo accesible desde localhost/VPN
	go func() {
		debugAddr := ":6060"
		log.Printf("✓ Diagnóstico pprof en %s (solo interno)", debugAddr)
		if err := http.ListenAndServe(debugAddr, nil); err != nil {
			log.Printf("[WARN] pprof no disponible: %v", err)
		}
	}()

	// 7. Iniciar concentrador WebSocket
	concentradorWS := ws.NuevoConcentradorConexiones()
	go concentradorWS.Ejecutar()
	log.Println("✓ Concentrador WebSocket iniciado")

	// 8. Registrar rutas REST + WebSocket
	router.RegisterRoutes(r, cfg, cockroach.DB(), concentradorWS)
	ws.RegistrarRutasWebSocket(r, concentradorWS, cfg, cockroach.DB())

	// Flags
	addrFlag := flag.String("addr", ":"+cfg.Server.Port, "puerto (e.g. :8060)")
	certFlag := flag.String("cert", "", "ruta fullchain.pem")
	keyFlag := flag.String("key", "", "ruta privkey.pem")
	flag.Parse()

	// 9. Iniciar servidor con graceful shutdown
	srv := &http.Server{
		Addr:         *addrFlag,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if *certFlag != "" && *keyFlag != "" {
			log.Printf("✓ Servidor (TLS) iniciado en %s [%s]", *addrFlag, cfg.Server.Env)
			if err := srv.ListenAndServeTLS(*certFlag, *keyFlag); err != nil && err != http.ErrServerClosed {
				log.Fatalf("Error iniciando servidor TLS: %v", err)
			}
		} else {
			log.Printf("✓ Servidor iniciado en %s [%s]", *addrFlag, cfg.Server.Env)
			if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				log.Fatalf("Error iniciando servidor: %v", err)
			}
		}
	}()

	<-quit
	log.Println("Apagando servidor...")

	// Cerrar todas las conexiones WebSocket antes del shutdown HTTP
	concentradorWS.Detener()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Error apagando servidor: %v", err)
	}
	log.Println("✓ Servidor apagado correctamente")
}
