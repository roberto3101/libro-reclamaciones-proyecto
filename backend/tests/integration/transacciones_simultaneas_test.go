package integration

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"testing"
	"time"

	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"

	"github.com/google/uuid"
)

// ─────────────────────────────────────────────────────────────────────────────
// Test de 3 transacciones simultáneas:
//
//   TX-1: CrearReclamo + Historial              → DEBE TENER ÉXITO
//   TX-2: CrearReclamo + Respuesta + Historial  → DEBE TENER ÉXITO
//   TX-3: CrearReclamo + Historial              → FALLA A PROPÓSITO
//
// Las 3 corren en paralelo con goroutines + sync.WaitGroup.
// Al terminar, se verifica que:
//   - TX-1 y TX-2 persistieron reclamo + historial (y respuesta)
//   - TX-3 no dejó nada en la BD (rollback completo)
// ─────────────────────────────────────────────────────────────────────────────

type resultadoTransaccion struct {
	nombre    string
	reclamoID uuid.UUID
	err       error
}

func TestTresTransaccionesSimultaneas_DosExitosasUnaFallida(t *testing.T) {
	saltarSiNoHayBD(t)
	ctx := context.Background()
	tenantID := tenantIDDePrueba(t)
	sedeID := sedeIDDePrueba(t, tenantID)

	reclamoRepo := repo.NewReclamoRepo(testDB)
	historialRepo := repo.NewHistorialRepo(testDB)
	respuestaRepo := repo.NewRespuestaRepo(testDB)

	var wg sync.WaitGroup
	resultados := make([]resultadoTransaccion, 3)

	// ─────────────────────────────────────────────────────────────────────
	// TX-1: Crear reclamo + historial (DEBE TENER ÉXITO)
	// Simula: un consumidor envía un reclamo desde el formulario público
	// ─────────────────────────────────────────────────────────────────────
	wg.Add(1)
	go func() {
		defer wg.Done()
		reclamo := crearReclamoDePrueba(tenantID, sedeID)
		reclamo.CodigoReclamo = fmt.Sprintf("TX1-OK-%s", uuid.New().String()[:8])
		reclamo.NombreCompleto = "TX-1 Consumidor Exitoso"

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
			if err := historialTx.Create(ctx, historial); err != nil {
				return fmt.Errorf("registrar historial: %w", err)
			}
			return nil
		})

		resultados[0] = resultadoTransaccion{
			nombre:    "TX-1 (crear reclamo + historial)",
			reclamoID: reclamo.ID,
			err:       err,
		}
	}()

	// ─────────────────────────────────────────────────────────────────────
	// TX-2: Crear reclamo + respuesta + cerrar + historial (DEBE TENER ÉXITO)
	// Simula: un asesor responde un reclamo y se cierra automáticamente
	// ─────────────────────────────────────────────────────────────────────
	wg.Add(1)
	go func() {
		defer wg.Done()
		reclamo := crearReclamoDePrueba(tenantID, sedeID)
		reclamo.CodigoReclamo = fmt.Sprintf("TX2-OK-%s", uuid.New().String()[:8])
		reclamo.NombreCompleto = "TX-2 Consumidor Con Respuesta"
		userID := uuid.New()

		err := repo.EjecutarEnTransaccion(ctx, testDB, func(tx *sql.Tx) error {
			reclamoTx := reclamoRepo.ConTransaccion(tx)
			respuestaTx := respuestaRepo.ConTransaccion(tx)
			historialTx := historialRepo.ConTransaccion(tx)

			// Paso 1: Crear el reclamo
			if err := reclamoTx.Create(ctx, reclamo); err != nil {
				return fmt.Errorf("insertar reclamo: %w", err)
			}

			// Paso 2: Historial de creación
			if err := historialTx.Create(ctx, &model.Historial{
				TenantModel: model.TenantModel{TenantID: tenantID},
				ReclamoID:   reclamo.ID,
				EstadoNuevo: model.EstadoPendiente,
				TipoAccion:  model.AccionCreacion,
			}); err != nil {
				return fmt.Errorf("historial de creacion: %w", err)
			}

			// Paso 3: Crear respuesta oficial
			respuesta := &model.Respuesta{
				TenantModel:      model.TenantModel{TenantID: tenantID},
				ReclamoID:        reclamo.ID,
				RespuestaEmpresa: "Estimado consumidor, su reclamo ha sido atendido satisfactoriamente.",
				RespondidoPor:    model.NullUUID{UUID: userID, Valid: true},
				Origen:           model.OrigenPanel,
			}
			if err := respuestaTx.Create(ctx, respuesta); err != nil {
				return fmt.Errorf("insertar respuesta: %w", err)
			}

			// Paso 4: Actualizar fecha de respuesta
			if err := reclamoTx.UpdateFechaRespuesta(ctx, tenantID, reclamo.ID); err != nil {
				return fmt.Errorf("actualizar fecha respuesta: %w", err)
			}

			// Paso 5: Cerrar reclamo automáticamente
			if err := reclamoTx.UpdateEstado(ctx, tenantID, reclamo.ID, model.EstadoCerrado, &userID); err != nil {
				return fmt.Errorf("cerrar reclamo: %w", err)
			}

			// Paso 6: Historial de respuesta + cierre
			if err := historialTx.Create(ctx, &model.Historial{
				TenantModel:    model.TenantModel{TenantID: tenantID},
				ReclamoID:      reclamo.ID,
				EstadoAnterior: model.NullString{NullString: sql.NullString{String: model.EstadoPendiente, Valid: true}},
				EstadoNuevo:    model.EstadoCerrado,
				TipoAccion:     model.AccionRespuesta,
				UsuarioAccion:  model.NullUUID{UUID: userID, Valid: true},
			}); err != nil {
				return fmt.Errorf("historial de respuesta: %w", err)
			}

			return nil
		})

		resultados[1] = resultadoTransaccion{
			nombre:    "TX-2 (crear reclamo + respuesta + cerrar + historial)",
			reclamoID: reclamo.ID,
			err:       err,
		}
	}()

	// ─────────────────────────────────────────────────────────────────────
	// TX-3: Crear reclamo + FALLO INTENCIONAL (DEBE HACER ROLLBACK)
	// Simula: el reclamo se inserta OK pero el historial explota
	// ─────────────────────────────────────────────────────────────────────
	wg.Add(1)
	go func() {
		defer wg.Done()
		reclamo := crearReclamoDePrueba(tenantID, sedeID)
		reclamo.CodigoReclamo = fmt.Sprintf("TX3-FAIL-%s", uuid.New().String()[:8])
		reclamo.NombreCompleto = "TX-3 Consumidor Que No Debe Existir"

		err := repo.EjecutarEnTransaccion(ctx, testDB, func(tx *sql.Tx) error {
			reclamoTx := reclamoRepo.ConTransaccion(tx)

			// El reclamo se inserta correctamente DENTRO de la transaccion
			if err := reclamoTx.Create(ctx, reclamo); err != nil {
				return fmt.Errorf("insertar reclamo: %w", err)
			}

			// FALLO INTENCIONAL: simula error al registrar historial
			return fmt.Errorf("ERROR SIMULADO: fallo de conexion al insertar historial")
		})

		resultados[2] = resultadoTransaccion{
			nombre:    "TX-3 (crear reclamo + FALLO INTENCIONAL)",
			reclamoID: reclamo.ID,
			err:       err,
		}
	}()

	// Esperar a que las 3 transacciones terminen
	wg.Wait()

	// ─────────────────────────────────────────────────────────────────────
	// VERIFICACIONES
	// ─────────────────────────────────────────────────────────────────────

	t.Log("========================================")
	t.Log("  RESULTADOS DE LAS 3 TRANSACCIONES")
	t.Log("========================================")

	// ── TX-1: Debe haber tenido éxito ──
	tx1 := resultados[0]
	t.Logf("\n[%s]", tx1.nombre)
	if tx1.err != nil {
		t.Fatalf("  FALLO (no esperado): %v", tx1.err)
	}
	t.Log("  Transaccion: COMMIT exitoso")

	reclamo1, _ := reclamoRepo.GetByID(ctx, tenantID, tx1.reclamoID)
	if reclamo1 == nil {
		t.Fatal("  El reclamo de TX-1 NO existe en la BD (deberia existir)")
	}
	t.Logf("  Reclamo: %s | Estado: %s | Consumidor: %s", reclamo1.CodigoReclamo, reclamo1.Estado, reclamo1.NombreCompleto)

	historial1 := contarHistorialDelReclamo(t, tenantID, tx1.reclamoID)
	if historial1 != 1 {
		t.Errorf("  Historial: se esperaba 1, se encontraron %d", historial1)
	}
	t.Logf("  Historial: %d registro(s) de CREACION", historial1)
	defer limpiarReclamoDePrueba(t, tenantID, tx1.reclamoID)

	// ── TX-2: Debe haber tenido éxito con respuesta y cierre ──
	tx2 := resultados[1]
	t.Logf("\n[%s]", tx2.nombre)
	if tx2.err != nil {
		t.Fatalf("  FALLO (no esperado): %v", tx2.err)
	}
	t.Log("  Transaccion: COMMIT exitoso")

	reclamo2, _ := reclamoRepo.GetByID(ctx, tenantID, tx2.reclamoID)
	if reclamo2 == nil {
		t.Fatal("  El reclamo de TX-2 NO existe en la BD (deberia existir)")
	}
	t.Logf("  Reclamo: %s | Estado: %s | Consumidor: %s", reclamo2.CodigoReclamo, reclamo2.Estado, reclamo2.NombreCompleto)

	if reclamo2.Estado != model.EstadoCerrado {
		t.Errorf("  Estado incorrecto: se esperaba CERRADO, se obtuvo %s", reclamo2.Estado)
	}
	if !reclamo2.FechaRespuesta.Valid {
		t.Error("  La fecha_respuesta deberia estar seteada")
	}
	t.Logf("  Fecha respuesta: %s", reclamo2.FechaRespuesta.Time.Format(time.RFC3339))

	respuestas2, _ := respuestaRepo.GetByReclamo(ctx, tenantID, tx2.reclamoID)
	if len(respuestas2) != 1 {
		t.Errorf("  Respuestas: se esperaba 1, se encontraron %d", len(respuestas2))
	}
	t.Logf("  Respuesta oficial: \"%s\"", respuestas2[0].RespuestaEmpresa)

	historial2 := contarHistorialDelReclamo(t, tenantID, tx2.reclamoID)
	if historial2 != 2 {
		t.Errorf("  Historial: se esperaban 2 (CREACION + RESPUESTA), se encontraron %d", historial2)
	}
	t.Logf("  Historial: %d registro(s) (CREACION + RESPUESTA)", historial2)
	defer limpiarReclamoDePrueba(t, tenantID, tx2.reclamoID)

	// ── TX-3: Debe haber fallado y NO dejar nada ──
	tx3 := resultados[2]
	t.Logf("\n[%s]", tx3.nombre)
	if tx3.err == nil {
		t.Fatal("  TX-3 deberia haber fallado pero retorno nil")
	}
	t.Logf("  Transaccion: ROLLBACK (error: %s)", tx3.err)

	reclamo3, _ := reclamoRepo.GetByID(ctx, tenantID, tx3.reclamoID)
	if reclamo3 != nil {
		limpiarReclamoDePrueba(t, tenantID, tx3.reclamoID)
		t.Fatal("  ATOMICIDAD VIOLADA: el reclamo de TX-3 existe en la BD (NO deberia existir)")
	}
	t.Log("  Reclamo: NO existe (rollback correcto)")

	historial3 := contarHistorialDelReclamo(t, tenantID, tx3.reclamoID)
	if historial3 != 0 {
		t.Errorf("  ATOMICIDAD VIOLADA: se encontraron %d registros de historial (deberian ser 0)", historial3)
	}
	t.Log("  Historial: 0 registros (rollback correcto)")

	// ── Resumen final ──
	t.Log("\n========================================")
	t.Log("  RESUMEN")
	t.Log("========================================")
	t.Log("  TX-1 (crear reclamo simple):     PERSISTIDO")
	t.Log("  TX-2 (reclamo + respuesta):       PERSISTIDO")
	t.Log("  TX-3 (fallo intencional):         REVERTIDO")
	t.Log("========================================")
}
