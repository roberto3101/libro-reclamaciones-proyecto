package helper

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	// Driver SQL Server
	_ "github.com/denisenkom/go-mssqldb"
)

// EmpresaResult contiene los datos basicos de una empresa del SQL Server.
type EmpresaResult struct {
	RUC             string `json:"ruc"`
	RazonSocial     string `json:"razon_social"`
	NombreComercial string `json:"nombre_comercial,omitempty"`
	Direccion       string `json:"direccion,omitempty"`
	Telefono        string `json:"telefono,omitempty"`
	Email           string `json:"email,omitempty"`
	Activa          bool   `json:"activa"`
}

var (
	sqlServerDB  *sql.DB
	sqlServerMu  sync.Mutex
)

// getSQLServerConnection retorna la conexion al SQL Server.
// Reintenta si la conexion previa fallo.
func getSQLServerConnection() (*sql.DB, error) {
	sqlServerMu.Lock()
	defer sqlServerMu.Unlock()

	// Si ya hay conexion activa, verificar que siga viva
	if sqlServerDB != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if sqlServerDB.PingContext(ctx) == nil {
			return sqlServerDB, nil
		}
		// Conexion muerta, cerrar y reconectar
		sqlServerDB.Close()
		sqlServerDB = nil
	}

	host := os.Getenv("SQLSERVER_HOST")
	port := os.Getenv("SQLSERVER_PORT")
	user := os.Getenv("SQLSERVER_USER")
	pass := os.Getenv("SQLSERVER_PASS")
	dbName := os.Getenv("SQLSERVER_DB")

	if host == "" || user == "" || dbName == "" {
		return nil, fmt.Errorf("SQL Server no configurado (variables SQLSERVER_* no definidas)")
	}

	if port == "" {
		port = "1433"
	}

	connStr := fmt.Sprintf("server=%s;port=%s;user id=%s;password=%s;database=%s;encrypt=disable;connection timeout=10",
		host, port, user, pass, dbName)

	db, err := sql.Open("sqlserver", connStr)
	if err != nil {
		return nil, fmt.Errorf("error abriendo conexion SQL Server: %w", err)
	}

	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(10 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("SQL Server no responde: %w", err)
	}

	log.Println("[SQL Server] Conexion establecida:", host+":"+port+"/"+dbName)
	sqlServerDB = db
	return sqlServerDB, nil
}

// ConsultarEmpresaPorRUC busca una empresa en la tabla zg_empresas del SQL Server.
// Retorna nil si la empresa no existe.
func ConsultarEmpresaPorRUC(ruc string) (*EmpresaResult, error) {
	if ruc == "" || len(ruc) != 11 {
		return nil, fmt.Errorf("RUC invalido: debe tener 11 digitos")
	}

	db, err := getSQLServerConnection()
	if err != nil {
		return nil, fmt.Errorf("consulta_empresa: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var empresa EmpresaResult
	// Query a la tabla zg_empresas de la base externa (SQLSERVER_DB).
	// NOTA: ajustar nombres de columna segun la tabla real del SQL Server
	err = db.QueryRowContext(ctx,
		`SELECT TOP 1
			ISNULL(ruc, '') AS ruc,
			ISNULL(nombrerazon, '') AS razon_social,
			ISNULL(nombrecomercial, '') AS nombre_comercial,
			ISNULL(direccion, '') AS direccion,
			ISNULL(telefono, '') AS telefono,
			ISNULL(email, '') AS email
		FROM dbo.zg_empresas
		WHERE ruc = @p1 AND ISNULL(activo, 0) = 1`,
		ruc,
	).Scan(&empresa.RUC, &empresa.RazonSocial, &empresa.NombreComercial, &empresa.Direccion, &empresa.Telefono, &empresa.Email)

	if err == sql.ErrNoRows {
		return nil, nil // No encontrada
	}
	if err != nil {
		return nil, fmt.Errorf("consulta_empresa query: %w", err)
	}

	empresa.Activa = true
	return &empresa, nil
}

// SQLServerDisponible retorna true si la conexion al SQL Server esta configurada y activa.
func SQLServerDisponible() bool {
	db, err := getSQLServerConnection()
	if err != nil || db == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return db.PingContext(ctx) == nil
}
