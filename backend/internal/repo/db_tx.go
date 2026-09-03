package repo

import (
	"context"
	"database/sql"
	"fmt"
)

// EjecutorSQL abstrae *sql.DB y *sql.Tx para que los repositorios
// puedan operar tanto dentro como fuera de una transacción.
type EjecutorSQL interface {
	ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row
}

// EjecutarEnTransaccion abre una transacción, ejecuta la función recibida,
// y hace commit si no hubo error o rollback automático si falló.
// CockroachDB usa aislamiento SERIALIZABLE por defecto (el más seguro).
func EjecutarEnTransaccion(ctx context.Context, db *sql.DB, operacion func(tx *sql.Tx) error) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("error al iniciar transaccion: %w", err)
	}
	defer tx.Rollback()

	if err := operacion(tx); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("error al confirmar transaccion: %w", err)
	}
	return nil
}
