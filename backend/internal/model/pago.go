package model

import (
	"time"

	"github.com/google/uuid"
)

// Pago registra cada cobro que entra al SaaS, venga de donde venga.
// Es el libro contable: sin una fila acá, no hubo plata.
type Pago struct {
	ID       uuid.UUID `json:"id" db:"id"`
	TenantID uuid.UUID `json:"tenant_id" db:"tenant_id"`

	SuscripcionID NullUUID  `json:"suscripcion_id" db:"suscripcion_id"`
	PlanID        uuid.UUID `json:"plan_id" db:"plan_id"`

	Proveedor         string     `json:"proveedor" db:"proveedor"`
	ReferenciaExterna NullString `json:"referencia_externa" db:"referencia_externa"`

	Monto  float64 `json:"monto" db:"monto"`
	Moneda string  `json:"moneda" db:"moneda"`
	Ciclo  string  `json:"ciclo" db:"ciclo"`
	Estado string  `json:"estado" db:"estado"`

	Email       NullString `json:"email" db:"email"`
	Descripcion NullString `json:"descripcion" db:"descripcion"`

	Payload []byte `json:"-" db:"payload"`

	ErrorCodigo  NullString `json:"error_codigo,omitempty" db:"error_codigo"`
	ErrorMensaje NullString `json:"error_mensaje,omitempty" db:"error_mensaje"`

	RegistradoPor NullUUID `json:"registrado_por" db:"registrado_por"`

	FechaPago          NullTime  `json:"fecha_pago" db:"fecha_pago"`
	FechaCreacion      time.Time `json:"fecha_creacion" db:"fecha_creacion"`
	FechaActualizacion time.Time `json:"fecha_actualizacion" db:"fecha_actualizacion"`
}

// Proveedores de pago aceptados.
const (
	ProveedorCulqi         = "CULQI"
	ProveedorMercadoPago   = "MERCADOPAGO"
	ProveedorYape          = "YAPE"
	ProveedorTransferencia = "TRANSFERENCIA"
	ProveedorManual        = "MANUAL"
)

// Estados de un pago.
const (
	PagoPendiente   = "PENDIENTE"
	PagoPagado      = "PAGADO"
	PagoFallido     = "FALLIDO"
	PagoReembolsado = "REEMBOLSADO"
)

// EsProveedorValido evita que llegue basura desde el request.
func EsProveedorValido(p string) bool {
	switch p {
	case ProveedorCulqi, ProveedorMercadoPago, ProveedorYape, ProveedorTransferencia, ProveedorManual:
		return true
	}
	return false
}
