package repo

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"libro-reclamaciones/internal/model"

	"github.com/google/uuid"
)

type UsuarioRepo struct {
	db *sql.DB
}

func NewUsuarioRepo(db *sql.DB) *UsuarioRepo {
	return &UsuarioRepo{db: db}
}

func (r *UsuarioRepo) GetByTenant(ctx context.Context, tenantID uuid.UUID) ([]model.UsuarioAdmin, error) {
	query := `
		SELECT tenant_id, id, email, nombre_completo, password_hash,
			rol, activo, debe_cambiar_password, ultimo_acceso,
			fecha_creacion, creado_por
		FROM usuarios_admin
		WHERE tenant_id = $1
		ORDER BY activo DESC, nombre_completo ASC`

	rows, err := r.db.QueryContext(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("usuario_repo.GetByTenant: %w", err)
	}
	defer rows.Close()

	return r.scanUsuarios(rows)
}

func (r *UsuarioRepo) GetByID(ctx context.Context, tenantID, userID uuid.UUID) (*model.UsuarioAdmin, error) {
	query := `
		SELECT tenant_id, id, email, nombre_completo, password_hash,
			rol, activo, debe_cambiar_password, ultimo_acceso,
			fecha_creacion, creado_por
		FROM usuarios_admin
		WHERE tenant_id = $1 AND id = $2`

	u := &model.UsuarioAdmin{}
	err := r.db.QueryRowContext(ctx, query, tenantID, userID).Scan(
		&u.TenantID, &u.ID, &u.Email, &u.NombreCompleto, &u.PasswordHash,
		&u.Rol, &u.Activo, &u.DebeCambiarPassword, &u.UltimoAcceso,
		&u.FechaCreacion, &u.CreadoPor,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("usuario_repo.GetByID: %w", err)
	}
	return u, nil
}

func (r *UsuarioRepo) GetByEmail(ctx context.Context, tenantID uuid.UUID, email string) (*model.UsuarioAdmin, error) {
	query := `
		SELECT tenant_id, id, email, nombre_completo, password_hash,
			rol, activo, debe_cambiar_password, ultimo_acceso,
			fecha_creacion, creado_por
		FROM usuarios_admin
		WHERE tenant_id = $1 AND email = $2`

	u := &model.UsuarioAdmin{}
	err := r.db.QueryRowContext(ctx, query, tenantID, email).Scan(
		&u.TenantID, &u.ID, &u.Email, &u.NombreCompleto, &u.PasswordHash,
		&u.Rol, &u.Activo, &u.DebeCambiarPassword, &u.UltimoAcceso,
		&u.FechaCreacion, &u.CreadoPor,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("usuario_repo.GetByEmail: %w", err)
	}
	return u, nil
}

// GetByEmailGlobal busca un usuario activo por email sin filtrar por tenant.
// Se usa en el login para resolver el tenant desde el usuario.
func (r *UsuarioRepo) GetByEmailGlobal(ctx context.Context, email string) (*model.UsuarioAdmin, error) {
	query := `
		SELECT tenant_id, id, email, nombre_completo, password_hash,
			rol, activo, debe_cambiar_password, ultimo_acceso,
			fecha_creacion, creado_por
		FROM usuarios_admin
		WHERE email = $1 AND activo = true
		LIMIT 1`

	u := &model.UsuarioAdmin{}
	err := r.db.QueryRowContext(ctx, query, email).Scan(
		&u.TenantID, &u.ID, &u.Email, &u.NombreCompleto, &u.PasswordHash,
		&u.Rol, &u.Activo, &u.DebeCambiarPassword, &u.UltimoAcceso,
		&u.FechaCreacion, &u.CreadoPor,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("usuario_repo.GetByEmailGlobal: %w", err)
	}
	return u, nil
}

func (r *UsuarioRepo) GetByEmailAndTenant(ctx context.Context, email string, tenantID uuid.UUID) (*model.UsuarioAdmin, error) {
	query := `
		SELECT tenant_id, id, email, nombre_completo, password_hash,
			rol, activo, debe_cambiar_password, ultimo_acceso,
			fecha_creacion, creado_por
		FROM usuarios_admin
		WHERE email = $1 AND tenant_id = $2 AND activo = true
		LIMIT 1`

	u := &model.UsuarioAdmin{}
	err := r.db.QueryRowContext(ctx, query, email, tenantID).Scan(
		&u.TenantID, &u.ID, &u.Email, &u.NombreCompleto, &u.PasswordHash,
		&u.Rol, &u.Activo, &u.DebeCambiarPassword, &u.UltimoAcceso,
		&u.FechaCreacion, &u.CreadoPor,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("usuario_repo.GetByEmailAndTenant: %w", err)
	}
	return u, nil
}

// AccesoUsuarioEnCuenta representa un "acceso" de un usuario (por email) a
// una empresa dentro de una cuenta. Se usa para alimentar la UI de búsqueda
// del modal "Agregar usuario existente" — muestra en qué empresas ya tiene
// acceso el email buscado dentro de la misma cuenta.
type AccesoUsuarioEnCuenta struct {
	TenantID       uuid.UUID `json:"tenant_id"`
	RazonSocial    string    `json:"razon_social"`
	Rol            string    `json:"rol"`
	NombreCompleto string    `json:"nombre_completo"`
	PasswordHash   string    `json:"-"`
	Activo         bool      `json:"activo"`
}

// BuscarEnCuentaPorEmail devuelve todas las filas de usuarios_admin con ese
// email que pertenecen a tenants de la cuenta indicada. Devuelve los datos
// necesarios para alimentar el modal "Agregar usuario existente": nombre,
// empresas actuales, rol y hash para reutilizar.
//
// Incluye filas INACTIVAS también — el frontend las usa para detectar si el
// usuario ya existió en la empresa destino y hay que reactivar en vez de
// crear.
func (r *UsuarioRepo) BuscarEnCuentaPorEmail(ctx context.Context, cuentaID uuid.UUID, email string) ([]AccesoUsuarioEnCuenta, error) {
	query := `
		SELECT ua.tenant_id, ct.razon_social, ua.rol, ua.nombre_completo,
		       ua.password_hash, ua.activo
		FROM usuarios_admin ua
		JOIN configuracion_tenant ct ON ct.tenant_id = ua.tenant_id
		WHERE ua.email = $1
		  AND ct.cuenta_id = $2
		ORDER BY ua.activo DESC, ct.razon_social ASC`

	rows, err := r.db.QueryContext(ctx, query, email, cuentaID)
	if err != nil {
		return nil, fmt.Errorf("usuario_repo.BuscarEnCuentaPorEmail: %w", err)
	}
	defer rows.Close()

	var accesos []AccesoUsuarioEnCuenta
	for rows.Next() {
		var a AccesoUsuarioEnCuenta
		if err := rows.Scan(&a.TenantID, &a.RazonSocial, &a.Rol, &a.NombreCompleto, &a.PasswordHash, &a.Activo); err != nil {
			return nil, fmt.Errorf("usuario_repo.BuscarEnCuentaPorEmail scan: %w", err)
		}
		accesos = append(accesos, a)
	}
	return accesos, rows.Err()
}

// CandidatoUsuarioCuenta representa un usuario candidato a ser "agregado
// como existente" a una empresa. Se devuelve una fila por cada (email) único
// dentro de la cuenta — cada candidato agrega en `Empresas` la lista de
// empresas donde ya tiene acceso (para mostrar chips en el UI).
//
// `YaEnDestino` indica si el usuario ya tiene acceso activo en la empresa
// destino. Esos candidatos NO son agregables (el frontend los muestra
// deshabilitados con un chip "Ya asignado").
type CandidatoUsuarioCuenta struct {
	Email          string                  `json:"email"`
	NombreCompleto string                  `json:"nombre_completo"`
	YaEnDestino    bool                    `json:"ya_en_destino"`
	Empresas       []AccesoUsuarioEnCuenta `json:"empresas"`
}

// ListarCandidatosAgregarAEmpresa devuelve los usuarios (agrupados por email)
// que existen ACTIVOS en alguna empresa de la cuenta indicada. Incluye
// también a los que ya están en el tenant destino, marcados con
// `YaEnDestino = true` — el frontend los muestra deshabilitados con un chip
// "Ya asignado" para dar visibilidad completa de los usuarios de la cuenta.
//
// Se excluyen únicamente los candidatos que solo existen en la empresa
// destino y en ninguna otra (caso borde: no hay otra empresa de referencia
// para reutilizar).
//
// Dedup: si el mismo email existe en varias empresas de la cuenta, se agrupa
// en un solo candidato con la lista completa de empresas actuales (incluida
// la destino si aplica). El nombre mostrado es el de la primera fila
// encontrada.
func (r *UsuarioRepo) ListarCandidatosAgregarAEmpresa(
	ctx context.Context,
	cuentaID uuid.UUID,
	tenantDestinoID uuid.UUID,
) ([]CandidatoUsuarioCuenta, error) {
	query := `
		SELECT ua.email, ua.nombre_completo, ua.tenant_id, ct.razon_social,
		       ua.rol, ua.password_hash, ua.activo
		FROM usuarios_admin ua
		JOIN configuracion_tenant ct ON ct.tenant_id = ua.tenant_id
		WHERE ct.cuenta_id = $1
		  AND ua.activo = true
		ORDER BY ua.email ASC, ct.razon_social ASC`

	rows, err := r.db.QueryContext(ctx, query, cuentaID)
	if err != nil {
		return nil, fmt.Errorf("usuario_repo.ListarCandidatosAgregarAEmpresa: %w", err)
	}
	defer rows.Close()

	// Agrupamos por email y marcamos cuáles están en el destino.
	type acumulador struct {
		nombre      string
		empresas    []AccesoUsuarioEnCuenta
		yaEnDestino bool
		// fuera del destino: cuántas empresas "reales" aportan contexto.
		// Si es 0 y yaEnDestino es true, solo existe en el destino y no
		// tiene sentido mostrarlo como candidato (es redundante con la
		// tabla de usuarios de la empresa).
		otrasEmpresas int
	}
	porEmail := map[string]*acumulador{}
	orden := []string{}

	for rows.Next() {
		var email string
		var a AccesoUsuarioEnCuenta
		if err := rows.Scan(&email, &a.NombreCompleto, &a.TenantID, &a.RazonSocial, &a.Rol, &a.PasswordHash, &a.Activo); err != nil {
			return nil, fmt.Errorf("usuario_repo.ListarCandidatosAgregarAEmpresa scan: %w", err)
		}
		// No exponemos el hash en esta respuesta.
		a.PasswordHash = ""

		grupo, existe := porEmail[email]
		if !existe {
			grupo = &acumulador{nombre: a.NombreCompleto}
			porEmail[email] = grupo
			orden = append(orden, email)
		}
		grupo.empresas = append(grupo.empresas, a)
		if a.TenantID == tenantDestinoID {
			grupo.yaEnDestino = true
		} else {
			grupo.otrasEmpresas++
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("usuario_repo.ListarCandidatosAgregarAEmpresa rows: %w", err)
	}

	candidatos := make([]CandidatoUsuarioCuenta, 0, len(orden))
	for _, email := range orden {
		g := porEmail[email]
		// Caso borde: el usuario solo existe en la empresa destino y en
		// ninguna otra de la cuenta. No es un "candidato existente" — lo
		// omitimos para no duplicar la tabla de usuarios actuales.
		if g.yaEnDestino && g.otrasEmpresas == 0 {
			continue
		}
		candidatos = append(candidatos, CandidatoUsuarioCuenta{
			Email:          email,
			NombreCompleto: g.nombre,
			YaEnDestino:    g.yaEnDestino,
			Empresas:       g.empresas,
		})
	}
	return candidatos, nil
}

// CrearConHash inserta un usuario reutilizando un password_hash ya calculado.
// Se usa desde el flujo "Agregar usuario existente" para mantener sincronizados
// los hashes entre empresas de la misma cuenta (no genera un hash nuevo).
func (r *UsuarioRepo) CrearConHash(ctx context.Context, u *model.UsuarioAdmin) error {
	query := `
		INSERT INTO usuarios_admin (
			tenant_id, email, nombre_completo, password_hash,
			rol, debe_cambiar_password, creado_por
		) VALUES ($1,$2,$3,$4,$5,false,$6)
		RETURNING id, fecha_creacion`
	return r.db.QueryRowContext(ctx, query,
		u.TenantID, u.Email, u.NombreCompleto, u.PasswordHash,
		u.Rol, u.CreadoPor,
	).Scan(&u.ID, &u.FechaCreacion)
}

// ReactivarYActualizar reactiva una fila existente de usuarios_admin y
// actualiza su rol y nombre. Se usa cuando el usuario ya había existido en
// la empresa destino y se le había desactivado — el flujo "Agregar existente"
// lo trata como reactivación en vez de duplicado.
func (r *UsuarioRepo) ReactivarYActualizar(ctx context.Context, tenantID, userID uuid.UUID, nombre, rol, passwordHash string) error {
	query := `
		UPDATE usuarios_admin
		SET activo = true,
		    nombre_completo = $1,
		    rol = $2,
		    password_hash = $3,
		    debe_cambiar_password = false
		WHERE tenant_id = $4 AND id = $5`
	_, err := r.db.ExecContext(ctx, query, nombre, rol, passwordHash, tenantID, userID)
	if err != nil {
		return fmt.Errorf("usuario_repo.ReactivarYActualizar: %w", err)
	}
	return nil
}

// ObtenerHashPorEmailEnCuenta devuelve el password_hash del primer usuario activo
// con ese email que pertenece a algún tenant de la cuenta indicada.
// Retorna ("", nil) si no existe ninguno.
func (r *UsuarioRepo) ObtenerHashPorEmailEnCuenta(ctx context.Context, email string, cuentaID uuid.UUID) (string, error) {
	query := `
		SELECT ua.password_hash
		FROM usuarios_admin ua
		JOIN configuracion_tenant ct ON ct.tenant_id = ua.tenant_id
		WHERE ua.email = $1
		  AND ct.cuenta_id = $2
		  AND ua.activo = true
		LIMIT 1`

	var hash string
	err := r.db.QueryRowContext(ctx, query, email, cuentaID).Scan(&hash)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("usuario_repo.ObtenerHashPorEmailEnCuenta: %w", err)
	}
	return hash, nil
}

// ObtenerActivosPorEmailEnCuenta devuelve los usuarios_admin activos con
// el email dado que pertenecen a tenants de la cuenta indicada. Se usa
// post-login (en SeleccionarEmpresa / CambiarEmpresa) para construir la
// lista del dropdown "Cambiar empresa" — ahí queremos mostrar solo empresas
// de la misma cuenta del tenant actual, no empresas de otras cuentas donde
// el email también exista. Eso mantiene consistencia con el selector inicial
// y evita que un login en una cuenta pueda saltar a otra cuenta sin validar
// password.
func (r *UsuarioRepo) ObtenerActivosPorEmailEnCuenta(ctx context.Context, email string, cuentaID uuid.UUID) ([]model.UsuarioAdmin, error) {
	query := `
		SELECT ua.tenant_id, ua.id, ua.email, ua.nombre_completo, ua.password_hash,
			ua.rol, ua.activo, ua.debe_cambiar_password, ua.ultimo_acceso,
			ua.fecha_creacion, ua.creado_por
		FROM usuarios_admin ua
		JOIN configuracion_tenant ct ON ct.tenant_id = ua.tenant_id
		WHERE ua.email = $1
		  AND ua.activo = true
		  AND ct.cuenta_id = $2`

	rows, err := r.db.QueryContext(ctx, query, email, cuentaID)
	if err != nil {
		return nil, fmt.Errorf("usuario_repo.ObtenerActivosPorEmailEnCuenta: %w", err)
	}
	defer rows.Close()

	var usuarios []model.UsuarioAdmin
	for rows.Next() {
		var u model.UsuarioAdmin
		if err := rows.Scan(
			&u.TenantID, &u.ID, &u.Email, &u.NombreCompleto, &u.PasswordHash,
			&u.Rol, &u.Activo, &u.DebeCambiarPassword, &u.UltimoAcceso,
			&u.FechaCreacion, &u.CreadoPor,
		); err != nil {
			return nil, fmt.Errorf("usuario_repo.ObtenerActivosPorEmailEnCuenta scan: %w", err)
		}
		usuarios = append(usuarios, u)
	}
	return usuarios, rows.Err()
}

func (r *UsuarioRepo) ObtenerTodosPorEmailGlobal(ctx context.Context, email string) ([]model.UsuarioAdmin, error) {
	query := `
		SELECT tenant_id, id, email, nombre_completo, password_hash,
			rol, activo, debe_cambiar_password, ultimo_acceso,
			fecha_creacion, creado_por
		FROM usuarios_admin
		WHERE email = $1 AND activo = true`

	rows, err := r.db.QueryContext(ctx, query, email)
	if err != nil {
		return nil, fmt.Errorf("usuario_repo.ObtenerTodosPorEmailGlobal: %w", err)
	}
	defer rows.Close()

	var usuarios []model.UsuarioAdmin
	for rows.Next() {
		var u model.UsuarioAdmin
		if err := rows.Scan(
			&u.TenantID, &u.ID, &u.Email, &u.NombreCompleto, &u.PasswordHash,
			&u.Rol, &u.Activo, &u.DebeCambiarPassword, &u.UltimoAcceso,
			&u.FechaCreacion, &u.CreadoPor,
		); err != nil {
			return nil, fmt.Errorf("usuario_repo.ObtenerTodosPorEmailGlobal scan: %w", err)
		}
		usuarios = append(usuarios, u)
	}
	return usuarios, rows.Err()
}

func (r *UsuarioRepo) Create(ctx context.Context, u *model.UsuarioAdmin) error {
	// debe_cambiar_password se fija explícitamente a false para que la
	// contraseña que el admin tipeó en el form de "Nuevo usuario" quede
	// como definitiva. Sin este override, el DEFAULT true de la tabla
	// forzaría al usuario a cambiar la password en su primer login, lo
	// cual genera olvidos y carga de soporte. Si el usuario quiere
	// cambiarla, lo hace desde su perfil.
	query := `
		INSERT INTO usuarios_admin (
			tenant_id, email, nombre_completo, password_hash,
			rol, debe_cambiar_password, creado_por
		) VALUES ($1,$2,$3,$4,$5,false,$6)
		RETURNING id, fecha_creacion`

	return r.db.QueryRowContext(ctx, query,
		u.TenantID, u.Email, u.NombreCompleto, u.PasswordHash,
		u.Rol, u.CreadoPor,
	).Scan(&u.ID, &u.FechaCreacion)
}

func (r *UsuarioRepo) Update(ctx context.Context, u *model.UsuarioAdmin) error {
	query := `
		UPDATE usuarios_admin SET
			nombre_completo = $1, rol = $2, activo = $3
		WHERE tenant_id = $4 AND id = $5`

	_, err := r.db.ExecContext(ctx, query,
		u.NombreCompleto, u.Rol, u.Activo,
		u.TenantID, u.ID,
	)
	if err != nil {
		return fmt.Errorf("usuario_repo.Update: %w", err)
	}
	return nil
}

// ActualizarPasswordEnCuenta actualiza el password_hash de TODAS las filas
// activas de usuarios_admin que comparten el mismo email dentro de la misma
// cuenta. Esto mantiene sincronizados los hashes entre las múltiples empresas
// a las que un usuario puede tener acceso, garantizando que el selector
// multi-empresa siga funcionando tras cualquier cambio de contraseña.
//
// Scope: solo propaga DENTRO de la misma cuenta. Si el mismo email existiera
// en cuentas distintas (clientes distintos del SaaS), esas filas no se tocan,
// lo cual es correcto: son identidades independientes con sus propios passwords.
//
// Parámetros:
//   - tenantID, userID: identifican la fila "origen" desde la que se deriva
//     el email y la cuenta_id a propagar.
//   - hash: el nuevo bcrypt hash a aplicar en todas las filas del grupo.
//   - debeCambiarPassword: se aplica a todas las filas actualizadas. En flujo
//     self-serve es false; en reset por admin/SA es true (fuerza al usuario
//     a cambiarlo al siguiente login).
func (r *UsuarioRepo) ActualizarPasswordEnCuenta(
	ctx context.Context,
	tenantID, userID uuid.UUID,
	hash string,
	debeCambiarPassword bool,
) error {
	// Paso 1: resolver email y cuenta_id a partir del (tenantID, userID) origen.
	var email string
	var cuentaID uuid.UUID
	lookupQuery := `
		SELECT ua.email, ct.cuenta_id
		FROM usuarios_admin ua
		JOIN configuracion_tenant ct ON ct.tenant_id = ua.tenant_id
		WHERE ua.tenant_id = $1 AND ua.id = $2
		LIMIT 1`
	err := r.db.QueryRowContext(ctx, lookupQuery, tenantID, userID).Scan(&email, &cuentaID)
	if err != nil {
		return fmt.Errorf("usuario_repo.ActualizarPasswordEnCuenta lookup: %w", err)
	}

	// Paso 2: propagar el hash a todas las filas con el mismo email dentro de
	// la cuenta. Solo se tocan filas activas — usuarios desactivados mantienen
	// su hash histórico para no interferir con flujos de reactivación futura.
	updateQuery := `
		UPDATE usuarios_admin
		SET password_hash = $1,
		    debe_cambiar_password = $2
		WHERE email = $3
		  AND tenant_id IN (
		      SELECT tenant_id FROM configuracion_tenant WHERE cuenta_id = $4
		  )
		  AND activo = true`
	_, err = r.db.ExecContext(ctx, updateQuery, hash, debeCambiarPassword, email, cuentaID)
	if err != nil {
		return fmt.Errorf("usuario_repo.ActualizarPasswordEnCuenta update: %w", err)
	}
	return nil
}

// UpdatePassword es un wrapper sobre ActualizarPasswordEnCuenta que mantiene
// compatibilidad con los call sites existentes. Aplica debe_cambiar_password=false
// (flujo self-serve: el usuario ya acaba de elegir su nueva contraseña).
func (r *UsuarioRepo) UpdatePassword(ctx context.Context, tenantID, userID uuid.UUID, hash string) error {
	return r.ActualizarPasswordEnCuenta(ctx, tenantID, userID, hash, false)
}

func (r *UsuarioRepo) UpdateUltimoAcceso(ctx context.Context, tenantID, userID uuid.UUID) error {
	query := `UPDATE usuarios_admin SET ultimo_acceso = $1 WHERE tenant_id = $2 AND id = $3`
	_, err := r.db.ExecContext(ctx, query, time.Now(), tenantID, userID)
	if err != nil {
		return fmt.Errorf("usuario_repo.UpdateUltimoAcceso: %w", err)
	}
	return nil
}

func (r *UsuarioRepo) Deactivate(ctx context.Context, tenantID, userID uuid.UUID) error {
	query := `UPDATE usuarios_admin SET activo = false WHERE tenant_id = $1 AND id = $2`
	_, err := r.db.ExecContext(ctx, query, tenantID, userID)
	if err != nil {
		return fmt.Errorf("usuario_repo.Deactivate: %w", err)
	}
	return nil
}

func (r *UsuarioRepo) Reactivate(ctx context.Context, tenantID, userID uuid.UUID) error {
	query := `UPDATE usuarios_admin SET activo = true WHERE tenant_id = $1 AND id = $2`
	_, err := r.db.ExecContext(ctx, query, tenantID, userID)
	if err != nil {
		return fmt.Errorf("usuario_repo.Reactivate: %w", err)
	}
	return nil
}

func (r *UsuarioRepo) CountActivos(ctx context.Context, tenantID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM usuarios_admin WHERE tenant_id = $1 AND activo = true", tenantID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("usuario_repo.CountActivos: %w", err)
	}
	return count, nil
}

func (r *UsuarioRepo) scanUsuarios(rows *sql.Rows) ([]model.UsuarioAdmin, error) {
	var usuarios []model.UsuarioAdmin
	for rows.Next() {
		var u model.UsuarioAdmin
		if err := rows.Scan(
			&u.TenantID, &u.ID, &u.Email, &u.NombreCompleto, &u.PasswordHash,
			&u.Rol, &u.Activo, &u.DebeCambiarPassword, &u.UltimoAcceso,
			&u.FechaCreacion, &u.CreadoPor,
		); err != nil {
			return nil, fmt.Errorf("usuario_repo.scan: %w", err)
		}
		usuarios = append(usuarios, u)
	}
	return usuarios, rows.Err()
}