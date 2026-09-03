package repo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"testing"

	_ "github.com/lib/pq"
)

var baseDeDatosDePrueba *sql.DB

func TestMain(m *testing.M) {
	host := envODefault("DB_HOST", "localhost")
	port := envODefault("DB_PORT", "26257")
	user := envODefault("DB_USER", "root")
	dbname := envODefault("DB_NAME", "libroreclamaciones")
	sslmode := envODefault("DB_SSLMODE", "disable")

	dsn := fmt.Sprintf("postgresql://%s@%s:%s/%s?sslmode=%s", user, host, port, dbname, sslmode)

	var err error
	baseDeDatosDePrueba, err = sql.Open("postgres", dsn)
	if err != nil {
		fmt.Printf("No se pudo conectar a la BD: %v\n", err)
		baseDeDatosDePrueba = nil
	} else if err = baseDeDatosDePrueba.Ping(); err != nil {
		fmt.Printf("La BD no responde: %v\n", err)
		baseDeDatosDePrueba = nil
	}

	code := m.Run()

	if baseDeDatosDePrueba != nil {
		baseDeDatosDePrueba.Close()
	}
	os.Exit(code)
}

func envODefault(clave, valorPorDefecto string) string {
	if v := os.Getenv(clave); v != "" {
		return v
	}
	return valorPorDefecto
}

func saltarSiNoHayBaseDeDatos(t *testing.T) {
	t.Helper()
	if baseDeDatosDePrueba == nil {
		t.Skip("Sin conexion a la base de datos, saltando test de integracion")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests para EjecutarEnTransaccion
// ─────────────────────────────────────────────────────────────────────────────

func TestEjecutarEnTransaccion_HaceCommitSiNoHayError(t *testing.T) {
	saltarSiNoHayBaseDeDatos(t)
	ctx := context.Background()

	// Crear tabla temporal para la prueba
	_, err := baseDeDatosDePrueba.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS _test_tx_commit (
			id INT PRIMARY KEY,
			valor STRING NOT NULL
		)`)
	if err != nil {
		t.Fatalf("No se pudo crear tabla temporal: %v", err)
	}
	defer baseDeDatosDePrueba.ExecContext(ctx, `DROP TABLE IF EXISTS _test_tx_commit`)
	baseDeDatosDePrueba.ExecContext(ctx, `DELETE FROM _test_tx_commit`)

	// Ejecutar dos inserts dentro de una transaccion
	err = EjecutarEnTransaccion(ctx, baseDeDatosDePrueba, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `INSERT INTO _test_tx_commit (id, valor) VALUES (1, 'primer_insert')`)
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO _test_tx_commit (id, valor) VALUES (2, 'segundo_insert')`)
		return err
	})
	if err != nil {
		t.Fatalf("EjecutarEnTransaccion devolvio error inesperado: %v", err)
	}

	// Verificar que AMBOS registros existen (commit exitoso)
	var cantidad int
	baseDeDatosDePrueba.QueryRowContext(ctx, `SELECT COUNT(*) FROM _test_tx_commit`).Scan(&cantidad)
	if cantidad != 2 {
		t.Errorf("Se esperaban 2 registros despues del commit, se encontraron %d", cantidad)
	}
}

func TestEjecutarEnTransaccion_HaceRollbackSiHayError(t *testing.T) {
	saltarSiNoHayBaseDeDatos(t)
	ctx := context.Background()

	_, err := baseDeDatosDePrueba.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS _test_tx_rollback (
			id INT PRIMARY KEY,
			valor STRING NOT NULL
		)`)
	if err != nil {
		t.Fatalf("No se pudo crear tabla temporal: %v", err)
	}
	defer baseDeDatosDePrueba.ExecContext(ctx, `DROP TABLE IF EXISTS _test_tx_rollback`)
	baseDeDatosDePrueba.ExecContext(ctx, `DELETE FROM _test_tx_rollback`)

	errorSimulado := errors.New("fallo intencional en el segundo insert")

	// Ejecutar: primer insert exitoso, segundo falla
	err = EjecutarEnTransaccion(ctx, baseDeDatosDePrueba, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `INSERT INTO _test_tx_rollback (id, valor) VALUES (1, 'este_no_debe_existir')`)
		if err != nil {
			return err
		}
		return errorSimulado
	})

	if err == nil {
		t.Fatal("Se esperaba un error pero EjecutarEnTransaccion retorno nil")
	}
	if !errors.Is(err, errorSimulado) {
		t.Errorf("Se esperaba el error simulado, se obtuvo: %v", err)
	}

	// Verificar que NO hay registros (rollback exitoso)
	var cantidad int
	baseDeDatosDePrueba.QueryRowContext(ctx, `SELECT COUNT(*) FROM _test_tx_rollback`).Scan(&cantidad)
	if cantidad != 0 {
		t.Errorf("Se esperaban 0 registros despues del rollback, se encontraron %d", cantidad)
	}
}

func TestEjecutarEnTransaccion_AtomicidadConMultiplesOperaciones(t *testing.T) {
	saltarSiNoHayBaseDeDatos(t)
	ctx := context.Background()

	_, err := baseDeDatosDePrueba.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS _test_tx_atomicidad (
			id INT PRIMARY KEY,
			valor STRING NOT NULL
		)`)
	if err != nil {
		t.Fatalf("No se pudo crear tabla temporal: %v", err)
	}
	defer baseDeDatosDePrueba.ExecContext(ctx, `DROP TABLE IF EXISTS _test_tx_atomicidad`)
	baseDeDatosDePrueba.ExecContext(ctx, `DELETE FROM _test_tx_atomicidad`)

	// Tres operaciones: las primeras dos exitosas, la tercera falla
	// Simula el caso real: INSERT reclamo OK, UPDATE OK, INSERT historial FALLA
	err = EjecutarEnTransaccion(ctx, baseDeDatosDePrueba, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `INSERT INTO _test_tx_atomicidad (id, valor) VALUES (1, 'reclamo')`)
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO _test_tx_atomicidad (id, valor) VALUES (2, 'actualizacion')`)
		if err != nil {
			return err
		}
		return errors.New("fallo al registrar historial")
	})

	if err == nil {
		t.Fatal("Se esperaba error por fallo en tercera operacion")
	}

	// NINGUNA de las tres operaciones debe haberse persistido
	var cantidad int
	baseDeDatosDePrueba.QueryRowContext(ctx, `SELECT COUNT(*) FROM _test_tx_atomicidad`).Scan(&cantidad)
	if cantidad != 0 {
		t.Errorf("Atomicidad violada: se esperaban 0 registros, se encontraron %d", cantidad)
	}
}
