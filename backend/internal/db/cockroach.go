package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq"

	"libro-reclamaciones/internal/config"
)

// CockroachDB encapsula la conexión y el pool.
type CockroachDB struct {
	Pool *sql.DB
	cfg  config.CockroachConfig
}

// NewCockroachDB crea una conexión a CockroachDB con pool configurado.
func NewCockroachDB(cfg config.CockroachConfig) (*CockroachDB, error) {
	pool, err := sql.Open("postgres", cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("cockroach: error abriendo conexión: %w", err)
	}

	pool.SetMaxOpenConns(cfg.MaxOpenConns)
	pool.SetMaxIdleConns(cfg.MaxIdleConns)
	pool.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	// Verificar conexión con timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := pool.PingContext(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("cockroach: no se pudo conectar a %s:%s/%s: %w",
			cfg.Host, cfg.Port, cfg.DBName, err)
	}

	return &CockroachDB{Pool: pool, cfg: cfg}, nil
}

// Health verifica que la conexión siga activa.
func (db *CockroachDB) Health(ctx context.Context) error {
	return db.Pool.PingContext(ctx)
}

// Close cierra el pool de conexiones.
func (db *CockroachDB) Close() error {
	if db.Pool != nil {
		return db.Pool.Close()
	}
	return nil
}

// DB retorna el pool para usar en repos.
func (db *CockroachDB) DB() *sql.DB {
	return db.Pool
}
