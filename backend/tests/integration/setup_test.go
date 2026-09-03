package integration

import (
	"database/sql"
	"fmt"
	"os"
	"testing"

	_ "github.com/lib/pq"
)

var testDB *sql.DB

func TestMain(m *testing.M) {
	host := envOrDefault("DB_HOST", "localhost")
	port := envOrDefault("DB_PORT", "26257")
	user := envOrDefault("DB_USER", "root")
	dbname := envOrDefault("DB_NAME", "libroreclamaciones")
	sslmode := envOrDefault("DB_SSLMODE", "disable")

	dsn := fmt.Sprintf("postgresql://%s@%s:%s/%s?sslmode=%s", user, host, port, dbname, sslmode)

	var err error
	testDB, err = sql.Open("postgres", dsn)
	if err != nil {
		fmt.Printf("⚠ No se pudo conectar a DB: %v\n", err)
		fmt.Println("  Los tests de integración se saltarán.")
		testDB = nil
	} else if err = testDB.Ping(); err != nil {
		fmt.Printf("⚠ DB no responde: %v\n", err)
		testDB = nil
	} else {
		fmt.Printf("✓ Conectado a %s:%s/%s\n", host, port, dbname)
	}

	code := m.Run()

	if testDB != nil {
		testDB.Close()
	}
	os.Exit(code)
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}