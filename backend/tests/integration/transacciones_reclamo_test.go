package integration

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/model/dto"
	"libro-reclamaciones/internal/repo"

	"github.com/google/uuid"
)

// ─────────────────────────────────────────────────────────────────────────────
// Tests de transaccionalidad para operaciones de reclamos.
//
// Validan que INSERT reclamo + INSERT historial son atómicos:
//   - Si ambos tienen éxito → ambos se persisten (commit)
//   - Si uno falla → ninguno se persiste (rollback)
//
// Requieren conexión a CockroachDB (se saltan si no hay BD disponible).
// ─────────────────────────────────────────────────────────────────────────────

func saltarSiNoHayBD(t *testing.T) {
	t.Helper()
	if testDB == nil {
		t.Skip("Sin conexion a la base de datos, saltando test de integracion")
	}
}

// tenantIDDePrueba retorna un tenant_id que exista en la BD para los tests.
// Si no existe ninguno, salta el test.
func tenantIDDePrueba(t *testing.T) uuid.UUID {
	t.Helper()
	var tenantID uuid.UUID
	err := testDB.QueryRowContext(context.Background(),
		`SELECT tenant_id FROM configuracion_tenant LIMIT 1`).Scan(&tenantID)
	if err != nil {
		t.Skip("No hay tenants en la BD, saltando test")
	}
	return tenantID
}

// sedeIDDePrueba retorna una sede activa del tenant dado.
func sedeIDDePrueba(t *testing.T, tenantID uuid.UUID) uuid.UUID {
	t.Helper()
	var sedeID uuid.UUID
	err := testDB.QueryRowContext(context.Background(),
		`SELECT id FROM sedes WHERE tenant_id = $1 AND activo = true LIMIT 1`, tenantID).Scan(&sedeID)
	if err != nil {
		t.Skip("No hay sedes activas para el tenant, saltando test")
	}
	return sedeID
}

func crearReclamoDePrueba(tenantID, sedeID uuid.UUID) *model.Reclamo {
	codigoUnico := fmt.Sprintf("RCL-TEST-%s", uuid.New().String()[:8])
	return &model.Reclamo{
		TenantModel:     model.TenantModel{TenantID: tenantID},
		CodigoReclamo:   codigoUnico,
		TipoSolicitud:   model.TipoReclamo,
		Estado:          model.EstadoPendiente,
		NombreCompleto:  "Consumidor de Prueba Transaccional",
		TipoDocumento:   "DNI",
		NumeroDocumento: "99999999",
		Telefono:        "999888777",
		Email:           "test-tx@example.com",
		DescripcionBien: "Producto de prueba para validar transacciones",
		FechaIncidente:  time.Now().AddDate(0, 0, -1),
		DetalleReclamo:  "Detalle de prueba transaccional",
		PedidoConsumidor: "Reembolso de prueba",
		CanalOrigen:     model.CanalWeb,
		SedeID:          model.NullUUID{UUID: sedeID, Valid: true},
		FechaLimiteRespuesta: model.NullTime{NullTime: sql.NullTime{
			Time: time.Now().AddDate(0, 0, 15), Valid: true,
		}},
	}
}

func contarHistorialDelReclamo(t *testing.T, tenantID, reclamoID uuid.UUID) int {
	t.Helper()
	var cantidad int
	err := testDB.QueryRowContext(context.Background(),
		`SELECT COUNT(*) FROM historial_reclamos WHERE tenant_id = $1 AND reclamo_id = $2`,
		tenantID, reclamoID).Scan(&cantidad)
	if err != nil {
		t.Fatalf("Error al contar historial: %v", err)
	}
	return cantidad
}

func limpiarReclamoDePrueba(t *testing.T, tenantID, reclamoID uuid.UUID) {
	t.Helper()
	ctx := context.Background()
	testDB.ExecContext(ctx, `DELETE FROM historial_reclamos WHERE tenant_id = $1 AND reclamo_id = $2`, tenantID, reclamoID)
	testDB.ExecContext(ctx, `DELETE FROM respuestas WHERE tenant_id = $1 AND reclamo_id = $2`, tenantID, reclamoID)
	testDB.ExecContext(ctx, `DELETE FROM reclamos WHERE tenant_id = $1 AND id = $2`, tenantID, reclamoID)
}

// ─────────────────────────────────────────────────────────────────────────────
// Test: Crear reclamo + historial atómicamente
// ─────────────────────────────────────────────────────────────────────────────

func TestCrearReclamoConHistorial_TransaccionExitosa(t *testing.T) {
	saltarSiNoHayBD(t)
	ctx := context.Background()
	tenantID := tenantIDDePrueba(t)
	sedeID := sedeIDDePrueba(t, tenantID)

	reclamoRepo := repo.NewReclamoRepo(testDB)
	historialRepo := repo.NewHistorialRepo(testDB)
	reclamo := crearReclamoDePrueba(tenantID, sedeID)

	err := repo.EjecutarEnTransaccion(ctx, testDB, func(tx *sql.Tx) error {
		reclamoTx := reclamoRepo.ConTransaccion(tx)
		historialTx := historialRepo.ConTransaccion(tx)

		if err := reclamoTx.Create(ctx, reclamo); err != nil {
			return fmt.Errorf("insertar reclamo: %w", err)
		}

		historial := &model.Historial{
			TenantModel: model.TenantModel{TenantID: tenantID},
			ReclamoID:   reclamo.ID,
			EstadoNuevo: model.EstadoPendiente,
			TipoAccion:  model.AccionCreacion,
		}
		return historialTx.Create(ctx, historial)
	})

	if err != nil {
		t.Fatalf("La transaccion fallo inesperadamente: %v", err)
	}
	defer limpiarReclamoDePrueba(t, tenantID, reclamo.ID)

	// Verificar que el reclamo existe
	reclamoGuardado, err := reclamoRepo.GetByID(ctx, tenantID, reclamo.ID)
	if err != nil || reclamoGuardado == nil {
		t.Fatal("El reclamo no se encontro despues del commit")
	}
	if reclamoGuardado.CodigoReclamo != reclamo.CodigoReclamo {
		t.Errorf("Codigo esperado %s, obtenido %s", reclamo.CodigoReclamo, reclamoGuardado.CodigoReclamo)
	}

	// Verificar que el historial existe
	cantidadHistorial := contarHistorialDelReclamo(t, tenantID, reclamo.ID)
	if cantidadHistorial != 1 {
		t.Errorf("Se esperaba 1 registro de historial, se encontraron %d", cantidadHistorial)
	}
}

func TestCrearReclamoConHistorial_RollbackSiFallaHistorial(t *testing.T) {
	saltarSiNoHayBD(t)
	ctx := context.Background()
	tenantID := tenantIDDePrueba(t)
	sedeID := sedeIDDePrueba(t, tenantID)

	reclamoRepo := repo.NewReclamoRepo(testDB)
	reclamo := crearReclamoDePrueba(tenantID, sedeID)

	// Simular fallo en el historial despues de insertar el reclamo exitosamente
	err := repo.EjecutarEnTransaccion(ctx, testDB, func(tx *sql.Tx) error {
		reclamoTx := reclamoRepo.ConTransaccion(tx)

		if err := reclamoTx.Create(ctx, reclamo); err != nil {
			return fmt.Errorf("insertar reclamo: %w", err)
		}

		// Forzar error simulando fallo en historial
		return fmt.Errorf("error simulado al registrar historial de creacion")
	})

	if err == nil {
		t.Fatal("Se esperaba error pero la transaccion retorno nil")
	}

	// El reclamo NO debe existir (rollback completo)
	reclamoGuardado, _ := reclamoRepo.GetByID(ctx, tenantID, reclamo.ID)
	if reclamoGuardado != nil {
		limpiarReclamoDePrueba(t, tenantID, reclamo.ID)
		t.Fatal("El reclamo NO deberia existir despues del rollback, pero se encontro")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Test: Cambiar estado + historial atómicamente
// ─────────────────────────────────────────────────────────────────────────────

func TestCambiarEstado_TransaccionExitosa(t *testing.T) {
	saltarSiNoHayBD(t)
	ctx := context.Background()
	tenantID := tenantIDDePrueba(t)
	sedeID := sedeIDDePrueba(t, tenantID)

	reclamoRepo := repo.NewReclamoRepo(testDB)
	historialRepo := repo.NewHistorialRepo(testDB)

	// Primero crear un reclamo base
	reclamo := crearReclamoDePrueba(tenantID, sedeID)
	if err := reclamoRepo.Create(ctx, reclamo); err != nil {
		t.Fatalf("No se pudo crear reclamo base: %v", err)
	}
	defer limpiarReclamoDePrueba(t, tenantID, reclamo.ID)

	userID := uuid.New()

	// Cambiar estado dentro de transaccion
	err := repo.EjecutarEnTransaccion(ctx, testDB, func(tx *sql.Tx) error {
		reclamoTx := reclamoRepo.ConTransaccion(tx)
		historialTx := historialRepo.ConTransaccion(tx)

		if err := reclamoTx.UpdateEstado(ctx, tenantID, reclamo.ID, model.EstadoEnProceso, &userID); err != nil {
			return fmt.Errorf("actualizar estado: %w", err)
		}

		historial := &model.Historial{
			TenantModel:    model.TenantModel{TenantID: tenantID},
			ReclamoID:      reclamo.ID,
			EstadoAnterior: model.NullString{NullString: sql.NullString{String: model.EstadoPendiente, Valid: true}},
			EstadoNuevo:    model.EstadoEnProceso,
			TipoAccion:     model.AccionCambioEstado,
			UsuarioAccion:  model.NullUUID{UUID: userID, Valid: true},
		}
		return historialTx.Create(ctx, historial)
	})

	if err != nil {
		t.Fatalf("La transaccion de cambio de estado fallo: %v", err)
	}

	// Verificar nuevo estado
	reclamoActualizado, _ := reclamoRepo.GetByID(ctx, tenantID, reclamo.ID)
	if reclamoActualizado.Estado != model.EstadoEnProceso {
		t.Errorf("Estado esperado %s, obtenido %s", model.EstadoEnProceso, reclamoActualizado.Estado)
	}

	// Verificar historial creado
	cantidadHistorial := contarHistorialDelReclamo(t, tenantID, reclamo.ID)
	if cantidadHistorial != 1 {
		t.Errorf("Se esperaba 1 registro de historial de cambio, se encontraron %d", cantidadHistorial)
	}
}

func TestCambiarEstado_RollbackSiFallaHistorial(t *testing.T) {
	saltarSiNoHayBD(t)
	ctx := context.Background()
	tenantID := tenantIDDePrueba(t)
	sedeID := sedeIDDePrueba(t, tenantID)

	reclamoRepo := repo.NewReclamoRepo(testDB)

	// Crear reclamo base en estado PENDIENTE
	reclamo := crearReclamoDePrueba(tenantID, sedeID)
	if err := reclamoRepo.Create(ctx, reclamo); err != nil {
		t.Fatalf("No se pudo crear reclamo base: %v", err)
	}
	defer limpiarReclamoDePrueba(t, tenantID, reclamo.ID)

	userID := uuid.New()

	// Intentar cambiar estado: update exitoso pero historial falla
	err := repo.EjecutarEnTransaccion(ctx, testDB, func(tx *sql.Tx) error {
		reclamoTx := reclamoRepo.ConTransaccion(tx)

		if err := reclamoTx.UpdateEstado(ctx, tenantID, reclamo.ID, model.EstadoEnProceso, &userID); err != nil {
			return err
		}

		// Simular fallo al insertar historial
		return fmt.Errorf("error simulado al registrar historial de cambio de estado")
	})

	if err == nil {
		t.Fatal("Se esperaba error pero la transaccion retorno nil")
	}

	// El estado debe seguir siendo PENDIENTE (rollback del update)
	reclamoSinCambio, _ := reclamoRepo.GetByID(ctx, tenantID, reclamo.ID)
	if reclamoSinCambio.Estado != model.EstadoPendiente {
		t.Errorf("El estado deberia seguir PENDIENTE despues del rollback, pero es %s", reclamoSinCambio.Estado)
	}

	// No debe haber historial
	cantidadHistorial := contarHistorialDelReclamo(t, tenantID, reclamo.ID)
	if cantidadHistorial != 0 {
		t.Errorf("No deberia haber historial despues del rollback, se encontraron %d", cantidadHistorial)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Test: Crear respuesta + cerrar reclamo + historial atómicamente
// ─────────────────────────────────────────────────────────────────────────────

func TestCrearRespuesta_TransaccionCompleta(t *testing.T) {
	saltarSiNoHayBD(t)
	ctx := context.Background()
	tenantID := tenantIDDePrueba(t)
	sedeID := sedeIDDePrueba(t, tenantID)

	reclamoRepo := repo.NewReclamoRepo(testDB)
	respuestaRepo := repo.NewRespuestaRepo(testDB)
	historialRepo := repo.NewHistorialRepo(testDB)

	// Crear reclamo base
	reclamo := crearReclamoDePrueba(tenantID, sedeID)
	if err := reclamoRepo.Create(ctx, reclamo); err != nil {
		t.Fatalf("No se pudo crear reclamo base: %v", err)
	}
	defer limpiarReclamoDePrueba(t, tenantID, reclamo.ID)

	userID := uuid.New()
	respuesta := &model.Respuesta{
		TenantModel:      model.TenantModel{TenantID: tenantID},
		ReclamoID:        reclamo.ID,
		RespuestaEmpresa: "Respuesta de prueba transaccional",
		RespondidoPor:    model.NullUUID{UUID: userID, Valid: true},
		Origen:           model.OrigenPanel,
	}

	// Transaccion completa: respuesta + fecha_respuesta + cerrar + historial
	err := repo.EjecutarEnTransaccion(ctx, testDB, func(tx *sql.Tx) error {
		respuestaTx := respuestaRepo.ConTransaccion(tx)
		reclamoTx := reclamoRepo.ConTransaccion(tx)
		historialTx := historialRepo.ConTransaccion(tx)

		if err := respuestaTx.Create(ctx, respuesta); err != nil {
			return fmt.Errorf("insertar respuesta: %w", err)
		}
		if err := reclamoTx.UpdateFechaRespuesta(ctx, tenantID, reclamo.ID); err != nil {
			return fmt.Errorf("actualizar fecha respuesta: %w", err)
		}
		if err := reclamoTx.UpdateEstado(ctx, tenantID, reclamo.ID, model.EstadoCerrado, &userID); err != nil {
			return fmt.Errorf("cerrar reclamo: %w", err)
		}
		return historialTx.Create(ctx, &model.Historial{
			TenantModel:    model.TenantModel{TenantID: tenantID},
			ReclamoID:      reclamo.ID,
			EstadoAnterior: model.NullString{NullString: sql.NullString{String: model.EstadoPendiente, Valid: true}},
			EstadoNuevo:    model.EstadoCerrado,
			TipoAccion:     model.AccionRespuesta,
			UsuarioAccion:  model.NullUUID{UUID: userID, Valid: true},
		})
	})

	if err != nil {
		t.Fatalf("La transaccion de respuesta fallo: %v", err)
	}

	// Verificar estado cerrado
	reclamoFinal, _ := reclamoRepo.GetByID(ctx, tenantID, reclamo.ID)
	if reclamoFinal.Estado != model.EstadoCerrado {
		t.Errorf("Estado esperado CERRADO, obtenido %s", reclamoFinal.Estado)
	}

	// Verificar fecha_respuesta no es null
	if !reclamoFinal.FechaRespuesta.Valid {
		t.Error("La fecha_respuesta deberia estar seteada despues de la respuesta")
	}

	// Verificar respuesta existe
	respuestas, _ := respuestaRepo.GetByReclamo(ctx, tenantID, reclamo.ID)
	if len(respuestas) != 1 {
		t.Errorf("Se esperaba 1 respuesta, se encontraron %d", len(respuestas))
	}

	// Verificar historial
	cantidadHistorial := contarHistorialDelReclamo(t, tenantID, reclamo.ID)
	if cantidadHistorial != 1 {
		t.Errorf("Se esperaba 1 registro de historial, se encontraron %d", cantidadHistorial)
	}
}

func TestCrearRespuesta_RollbackSiFallaAlCerrarReclamo(t *testing.T) {
	saltarSiNoHayBD(t)
	ctx := context.Background()
	tenantID := tenantIDDePrueba(t)
	sedeID := sedeIDDePrueba(t, tenantID)

	reclamoRepo := repo.NewReclamoRepo(testDB)
	respuestaRepo := repo.NewRespuestaRepo(testDB)

	// Crear reclamo base
	reclamo := crearReclamoDePrueba(tenantID, sedeID)
	if err := reclamoRepo.Create(ctx, reclamo); err != nil {
		t.Fatalf("No se pudo crear reclamo base: %v", err)
	}
	defer limpiarReclamoDePrueba(t, tenantID, reclamo.ID)

	userID := uuid.New()
	respuesta := &model.Respuesta{
		TenantModel:      model.TenantModel{TenantID: tenantID},
		ReclamoID:        reclamo.ID,
		RespuestaEmpresa: "Respuesta que no debe persistir",
		RespondidoPor:    model.NullUUID{UUID: userID, Valid: true},
		Origen:           model.OrigenPanel,
	}

	// Simular: respuesta OK, fecha OK, pero falla al cerrar reclamo
	err := repo.EjecutarEnTransaccion(ctx, testDB, func(tx *sql.Tx) error {
		respuestaTx := respuestaRepo.ConTransaccion(tx)
		reclamoTx := reclamoRepo.ConTransaccion(tx)

		if err := respuestaTx.Create(ctx, respuesta); err != nil {
			return err
		}
		if err := reclamoTx.UpdateFechaRespuesta(ctx, tenantID, reclamo.ID); err != nil {
			return err
		}

		// Simular fallo al cerrar
		return fmt.Errorf("error simulado al cerrar reclamo automaticamente")
	})

	if err == nil {
		t.Fatal("Se esperaba error pero la transaccion retorno nil")
	}

	// La respuesta NO debe existir (rollback)
	respuestas, _ := respuestaRepo.GetByReclamo(ctx, tenantID, reclamo.ID)
	if len(respuestas) != 0 {
		t.Errorf("No deberian existir respuestas despues del rollback, se encontraron %d", len(respuestas))
	}

	// El reclamo debe seguir PENDIENTE
	reclamoSinCambio, _ := reclamoRepo.GetByID(ctx, tenantID, reclamo.ID)
	if reclamoSinCambio.Estado != model.EstadoPendiente {
		t.Errorf("El estado deberia seguir PENDIENTE, pero es %s", reclamoSinCambio.Estado)
	}

	// La fecha_respuesta debe seguir null
	if reclamoSinCambio.FechaRespuesta.Valid {
		t.Error("La fecha_respuesta deberia ser null despues del rollback")
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Test: ConTransaccion retorna copia independiente (no muta el repo original)
// ─────────────────────────────────────────────────────────────────────────────

func TestConTransaccion_RetornaCopiaIndependiente(t *testing.T) {
	saltarSiNoHayBD(t)
	ctx := context.Background()

	reclamoRepo := repo.NewReclamoRepo(testDB)

	tx, err := testDB.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("No se pudo iniciar transaccion: %v", err)
	}
	defer tx.Rollback()

	repoConTx := reclamoRepo.ConTransaccion(tx)

	// El repo con transaccion debe ser una instancia diferente
	if repoConTx == reclamoRepo {
		t.Error("ConTransaccion debe retornar una copia, no el mismo puntero")
	}

	// El repo original debe seguir funcionando con la BD directa
	// (no debe haber sido mutado por ConTransaccion)
	_, _, err = reclamoRepo.GetByTenant(ctx, uuid.New(), dto.PaginationRequest{Page: 1, PerPage: 1}, repo.FiltrosListado{})
	// No deberia fallar por "transaction already committed/rolled back"
	if err != nil {
		t.Errorf("El repo original no deberia haber sido afectado por ConTransaccion: %v", err)
	}
}
