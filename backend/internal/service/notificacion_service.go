package service

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"net/smtp"
	"strings"
	"time"

	"libro-reclamaciones/internal/config"
	"libro-reclamaciones/internal/model"
	"libro-reclamaciones/internal/repo"
)

type NotificacionService struct {
	cfg            config.SMTPConfig
	app            config.AppConfig
	plantillaRepo  *repo.PlantillaEmailRepo
}

func NewNotificacionService(cfg config.SMTPConfig, app config.AppConfig, plantillaRepo *repo.PlantillaEmailRepo) *NotificacionService {
	return &NotificacionService{cfg: cfg, app: app, plantillaRepo: plantillaRepo}
}

// ─── BRANDING HELPER ────────────────────────────────────────────────────────

type brandingInfo struct {
	color    string
	logoHTML string
	slug     string
	logoData []byte // bytes decodificados si es base64
	logoMIME string // e.g. "image/jpeg"
}

// parseDataURL extrae MIME type y bytes de un data URL (data:image/jpeg;base64,...)
func parseDataURL(dataURL string) (mime string, data []byte, ok bool) {
	if !strings.HasPrefix(dataURL, "data:") {
		return "", nil, false
	}
	parts := strings.SplitN(dataURL, ",", 2)
	if len(parts) != 2 {
		return "", nil, false
	}
	header := strings.TrimPrefix(parts[0], "data:")
	header = strings.TrimSuffix(header, ";base64")
	decoded, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return "", nil, false
	}
	return header, decoded, true
}

func getBranding(tenant *model.Tenant) brandingInfo {
	b := brandingInfo{
		color: "#1a56db",
		slug:  "portal",
	}
	razonSocial := "La Empresa"

	if tenant != nil {
		if tenant.ColorPrimario != "" {
			b.color = tenant.ColorPrimario
		}
		razonSocial = tenant.RazonSocial
		if tenant.Slug != "" {
			b.slug = tenant.Slug
		}
	}

	// Fallback: texto plano
	b.logoHTML = `<h2 style="color: ` + b.color + `; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">` + razonSocial + `</h2>`

	if tenant != nil && tenant.LogoURL.Valid && tenant.LogoURL.String != "" {
		logoURL := tenant.LogoURL.String

		// ¿Es base64 data URL? → usar CID inline
		if mime, data, ok := parseDataURL(logoURL); ok {
			b.logoData = data
			b.logoMIME = mime
			b.logoHTML = `<img src="cid:logo" alt="` + razonSocial + `" style="max-height: 56px; max-width: 200px; object-fit: contain;">`
		} else {
			// URL normal (https://...)
			b.logoHTML = `<img src="` + logoURL + `" alt="` + razonSocial + `" style="max-height: 56px; max-width: 200px; object-fit: contain;">`
		}
	}

	return b
}

// buildEmail construye el HTML completo del correo.
// Cada línea se mantiene corta para cumplir con los límites SMTP (RFC 2821).
func buildEmail(color, logoHTML, innerContent, footerText string) string {
	var sb strings.Builder

	sb.WriteString("<!DOCTYPE html>\r\n")
	sb.WriteString("<html lang=\"es\">\r\n")
	sb.WriteString("<head>\r\n")
	sb.WriteString("  <meta charset=\"UTF-8\">\r\n")
	sb.WriteString("  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\r\n")
	sb.WriteString("  <title>Notificacion</title>\r\n")
	sb.WriteString("</head>\r\n")
	sb.WriteString("<body style=\"margin: 0; padding: 0; background-color: #f4f6f9;\r\n")
	sb.WriteString("  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;\r\n")
	sb.WriteString("  color: #1f2937; -webkit-font-smoothing: antialiased;\">\r\n")
	sb.WriteString("<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\"\r\n")
	sb.WriteString("  style=\"background-color: #f4f6f9;\">\r\n")
	sb.WriteString("  <tr>\r\n")
	sb.WriteString("    <td align=\"center\" style=\"padding: 40px 16px;\">\r\n")
	sb.WriteString("      <table role=\"presentation\" width=\"600\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\"\r\n")
	sb.WriteString("        style=\"max-width: 600px; width: 100%; background-color: #ffffff;\r\n")
	sb.WriteString("        border-radius: 12px; overflow: hidden;\r\n")
	sb.WriteString("        box-shadow: 0 4px 24px rgba(0,0,0,0.06);\">\r\n")

	// Header
	sb.WriteString("        <tr>\r\n")
	sb.WriteString("          <td style=\"padding: 32px 40px 24px 40px; text-align: center;\r\n")
	sb.WriteString("            border-bottom: 3px solid ")
	sb.WriteString(color)
	sb.WriteString(";\">\r\n")
	sb.WriteString("            ")
	sb.WriteString(logoHTML)
	sb.WriteString("\r\n")
	sb.WriteString("          </td>\r\n")
	sb.WriteString("        </tr>\r\n")

	// Body
	sb.WriteString("        <tr>\r\n")
	sb.WriteString("          <td style=\"padding: 36px 40px 32px 40px;\">\r\n")
	writeWrapped(&sb, innerContent)
	sb.WriteString("\r\n")
	sb.WriteString("          </td>\r\n")
	sb.WriteString("        </tr>\r\n")

	// Footer
	sb.WriteString("        <tr>\r\n")
	sb.WriteString("          <td style=\"padding: 20px 40px 28px 40px;\r\n")
	sb.WriteString("            background-color: #f9fafb; border-top: 1px solid #e5e7eb;\">\r\n")
	sb.WriteString("            <p style=\"margin: 0; font-size: 12px; color: #9ca3af;\r\n")
	sb.WriteString("              text-align: center; line-height: 1.6;\">\r\n")
	sb.WriteString("              ")
	sb.WriteString(footerText)
	sb.WriteString("\r\n")
	sb.WriteString("            </p>\r\n")
	sb.WriteString("          </td>\r\n")
	sb.WriteString("        </tr>\r\n")

	sb.WriteString("      </table>\r\n")
	sb.WriteString("    </td>\r\n")
	sb.WriteString("  </tr>\r\n")
	sb.WriteString("</table>\r\n")
	sb.WriteString("</body>\r\n")
	sb.WriteString("</html>\r\n")

	return sb.String()
}

// writeWrapped escribe contenido HTML asegurando que ninguna línea exceda 900 caracteres.
func writeWrapped(sb *strings.Builder, content string) {
	const maxLine = 900

	for len(content) > 0 {
		if len(content) <= maxLine {
			sb.WriteString(content)
			return
		}

		chunk := content[:maxLine]
		cutAt := -1

		lastGt := strings.LastIndex(chunk, ">")
		if lastGt > maxLine/2 {
			cutAt = lastGt + 1
		}

		if cutAt == -1 {
			lastSpace := strings.LastIndex(chunk, " ")
			if lastSpace > maxLine/2 {
				cutAt = lastSpace + 1
			}
		}

		if cutAt == -1 {
			cutAt = maxLine
		}

		sb.WriteString(content[:cutAt])
		sb.WriteString("\r\n")
		content = content[cutAt:]
	}
}

// ─── PLANTILLA HELPER ────────────────────────────────────────────────────────

// obtenerPlantilla carga la plantilla del tenant desde DB. Si no existe o hay error, retorna nil.
func (s *NotificacionService) obtenerPlantilla(ctx context.Context, tenant *model.Tenant, tipoEvento string) *model.PlantillaEmail {
	if s.plantillaRepo == nil || tenant == nil {
		return nil
	}
	p, err := s.plantillaRepo.GetByTipoEvento(ctx, tenant.TenantID, tipoEvento)
	if err != nil || p == nil {
		return nil
	}
	if !p.Activa {
		return nil
	}
	return p
}

// ─── EMAILS ─────────────────────────────────────────────────────────────────

// EnviarNotificacionReclamo envía la confirmación de registro al CLIENTE.
func (s *NotificacionService) EnviarNotificacionReclamo(
	ctx context.Context, paraEmail string, tenant *model.Tenant,
	codigoReclamo, nombreCliente, fecha string,
) error {
	if s.cfg.User == "" || s.cfg.Pass == "" {
		return nil
	}

	b := getBranding(tenant)
	color, logoHTML := b.color, b.logoHTML
	razon := "La Empresa"
	if tenant != nil {
		razon = tenant.RazonSocial
	}

	// Variables disponibles para este tipo
	vars := map[string]string{
		"nombre_cliente":  nombreCliente,
		"codigo_reclamo":  codigoReclamo,
		"fecha":           fecha,
		"razon_social":    razon,
	}

	// Textos por defecto
	asunto := "Confirmacion de Registro - " + codigoReclamo
	saludoTexto := "Hola, " + nombreCliente
	cuerpoTexto := "Hemos recibido su solicitud correctamente. A continuacion los datos de referencia:"
	footerTexto := "Este correo fue enviado por <strong>" + razon + "</strong>.<br>\r\nSi no reconoce esta solicitud, puede ignorar este mensaje."

	// Cargar plantilla personalizada desde DB
	if p := s.obtenerPlantilla(ctx, tenant, model.EventoConfirmacionReclamo); p != nil {
		asunto = ReemplazarVariables(p.Asunto, vars)
		saludoTexto = ReemplazarVariables(p.Saludo, vars)
		cuerpoTexto = ReemplazarVariables(p.CuerpoPrincipal, vars)
		footerTexto = ReemplazarVariables(p.TextoPie, vars)
	}

	var inner strings.Builder
	inner.WriteString(`<h3 style="margin: 0 0 8px 0; font-size: 18px;` + "\r\n")
	inner.WriteString(`  color: #111827;">` + saludoTexto + `</h3>` + "\r\n")
	inner.WriteString(`<p style="margin: 0 0 24px 0; font-size: 15px;` + "\r\n")
	inner.WriteString(`  color: #4b5563; line-height: 1.6;">` + "\r\n")
	inner.WriteString(`  ` + cuerpoTexto + "\r\n")
	inner.WriteString(`</p>` + "\r\n")
	inner.WriteString(`<table role="presentation" width="100%"` + "\r\n")
	inner.WriteString(`  cellspacing="0" cellpadding="0" border="0"` + "\r\n")
	inner.WriteString(`  style="background-color: #f9fafb;` + "\r\n")
	inner.WriteString(`  border-radius: 8px; border: 1px solid #e5e7eb;">` + "\r\n")
	inner.WriteString(`  <tr>` + "\r\n")
	inner.WriteString(`    <td style="padding: 20px 24px;">` + "\r\n")
	inner.WriteString(`      <table role="presentation" width="100%"` + "\r\n")
	inner.WriteString(`        cellspacing="0" cellpadding="0" border="0">` + "\r\n")
	inner.WriteString(`        <tr>` + "\r\n")
	inner.WriteString(`          <td style="padding-bottom: 12px;">` + "\r\n")
	inner.WriteString(`            <span style="font-size: 12px; color: #6b7280;` + "\r\n")
	inner.WriteString(`              text-transform: uppercase; letter-spacing: 0.5px;` + "\r\n")
	inner.WriteString(`              font-weight: 600;">Codigo de seguimiento</span><br>` + "\r\n")
	inner.WriteString(`            <span style="font-size: 18px; font-weight: 700;` + "\r\n")
	inner.WriteString(`              color: ` + color + `; letter-spacing: 0.3px;">` + "\r\n")
	inner.WriteString(`              ` + codigoReclamo + `</span>` + "\r\n")
	inner.WriteString(`          </td>` + "\r\n")
	inner.WriteString(`        </tr>` + "\r\n")
	inner.WriteString(`        <tr>` + "\r\n")
	inner.WriteString(`          <td>` + "\r\n")
	inner.WriteString(`            <span style="font-size: 12px; color: #6b7280;` + "\r\n")
	inner.WriteString(`              text-transform: uppercase; letter-spacing: 0.5px;` + "\r\n")
	inner.WriteString(`              font-weight: 600;">Fecha de registro</span><br>` + "\r\n")
	inner.WriteString(`            <span style="font-size: 15px;` + "\r\n")
	inner.WriteString(`              color: #374151;">` + fecha + `</span>` + "\r\n")
	inner.WriteString(`          </td>` + "\r\n")
	inner.WriteString(`        </tr>` + "\r\n")
	inner.WriteString(`      </table>` + "\r\n")
	inner.WriteString(`    </td>` + "\r\n")
	inner.WriteString(`  </tr>` + "\r\n")
	inner.WriteString(`</table>` + "\r\n")
	inner.WriteString(buildBotonSeguimiento(s.app.URLPublica, b.slug, color, "Seguir mi reclamo"))

	cuerpo := buildEmail(color, logoHTML, inner.String(), footerTexto)
	return s.enviarEmailBase(paraEmail, asunto, cuerpo, nil, "", b.logoData, b.logoMIME)
}

// EnviarNotificacionNuevoReclamoEmpresa notifica a la empresa que llegó un reclamo nuevo.
func (s *NotificacionService) EnviarNotificacionNuevoReclamoEmpresa(
	ctx context.Context, emailEmpresa string, tenant *model.Tenant,
	codigoReclamo, nombreCliente, tipoSolicitud, fecha string,
) error {
	if s.cfg.User == "" || s.cfg.Pass == "" {
		return nil
	}

	b := getBranding(tenant)
	color, logoHTML := b.color, b.logoHTML
	razon := "La Empresa"
	if tenant != nil {
		razon = tenant.RazonSocial
	}

	vars := map[string]string{
		"codigo_reclamo":  codigoReclamo,
		"nombre_cliente":  nombreCliente,
		"tipo_solicitud":  tipoSolicitud,
		"fecha":           fecha,
		"razon_social":    razon,
	}

	asunto := "Nuevo " + tipoSolicitud + " recibido - " + codigoReclamo
	saludoTexto := "Nuevo caso registrado"
	cuerpoTexto := "Se ha registrado una nueva solicitud en su libro de reclamaciones que requiere atencion."
	footerTexto := "Notificacion interna del sistema de Libro de Reclamaciones."

	if p := s.obtenerPlantilla(ctx, tenant, model.EventoNuevoReclamoEmpresa); p != nil {
		asunto = ReemplazarVariables(p.Asunto, vars)
		saludoTexto = ReemplazarVariables(p.Saludo, vars)
		cuerpoTexto = ReemplazarVariables(p.CuerpoPrincipal, vars)
		footerTexto = ReemplazarVariables(p.TextoPie, vars)
	}

	badgeColor := "#dc2626"
	if tipoSolicitud == "QUEJA" {
		badgeColor = "#f59e0b"
	}

	var inner strings.Builder
	inner.WriteString(`<h3 style="margin: 0 0 8px 0; font-size: 18px;` + "\r\n")
	inner.WriteString(`  color: #111827;">` + saludoTexto + `</h3>` + "\r\n")
	inner.WriteString(`<p style="margin: 0 0 24px 0; font-size: 15px;` + "\r\n")
	inner.WriteString(`  color: #4b5563; line-height: 1.6;">` + "\r\n")
	inner.WriteString(`  ` + cuerpoTexto + "\r\n")
	inner.WriteString(`</p>` + "\r\n")
	inner.WriteString(`<table role="presentation" width="100%"` + "\r\n")
	inner.WriteString(`  cellspacing="0" cellpadding="0" border="0"` + "\r\n")
	inner.WriteString(`  style="background-color: #fef2f2;` + "\r\n")
	inner.WriteString(`  border-radius: 8px; border: 1px solid #fecaca;">` + "\r\n")
	inner.WriteString(`  <tr>` + "\r\n")
	inner.WriteString(`    <td style="padding: 20px 24px;">` + "\r\n")
	inner.WriteString(`      <table role="presentation" width="100%"` + "\r\n")
	inner.WriteString(`        cellspacing="0" cellpadding="0" border="0">` + "\r\n")
	inner.WriteString(`        <tr>` + "\r\n")
	inner.WriteString(`          <td style="padding-bottom: 12px;">` + "\r\n")
	inner.WriteString(`            <span style="display: inline-block;` + "\r\n")
	inner.WriteString(`              padding: 3px 10px; border-radius: 4px;` + "\r\n")
	inner.WriteString(`              font-size: 11px; font-weight: 700;` + "\r\n")
	inner.WriteString(`              color: #ffffff; background-color: ` + badgeColor + `;` + "\r\n")
	inner.WriteString(`              text-transform: uppercase;">` + tipoSolicitud + `</span>` + "\r\n")
	inner.WriteString(`          </td>` + "\r\n")
	inner.WriteString(`        </tr>` + "\r\n")
	inner.WriteString(`        <tr>` + "\r\n")
	inner.WriteString(`          <td style="padding-bottom: 8px;">` + "\r\n")
	inner.WriteString(`            <span style="font-size: 12px; color: #6b7280;` + "\r\n")
	inner.WriteString(`              text-transform: uppercase;` + "\r\n")
	inner.WriteString(`              font-weight: 600;">Codigo</span><br>` + "\r\n")
	inner.WriteString(`            <span style="font-size: 17px;` + "\r\n")
	inner.WriteString(`              font-weight: 700; color: #111827;">` + "\r\n")
	inner.WriteString(`              ` + codigoReclamo + `</span>` + "\r\n")
	inner.WriteString(`          </td>` + "\r\n")
	inner.WriteString(`        </tr>` + "\r\n")
	inner.WriteString(`        <tr>` + "\r\n")
	inner.WriteString(`          <td style="padding-bottom: 8px;">` + "\r\n")
	inner.WriteString(`            <span style="font-size: 12px; color: #6b7280;` + "\r\n")
	inner.WriteString(`              text-transform: uppercase;` + "\r\n")
	inner.WriteString(`              font-weight: 600;">Consumidor</span><br>` + "\r\n")
	inner.WriteString(`            <span style="font-size: 15px;` + "\r\n")
	inner.WriteString(`              color: #374151;">` + nombreCliente + `</span>` + "\r\n")
	inner.WriteString(`          </td>` + "\r\n")
	inner.WriteString(`        </tr>` + "\r\n")
	inner.WriteString(`        <tr>` + "\r\n")
	inner.WriteString(`          <td>` + "\r\n")
	inner.WriteString(`            <span style="font-size: 12px; color: #6b7280;` + "\r\n")
	inner.WriteString(`              text-transform: uppercase;` + "\r\n")
	inner.WriteString(`              font-weight: 600;">Fecha</span><br>` + "\r\n")
	inner.WriteString(`            <span style="font-size: 15px;` + "\r\n")
	inner.WriteString(`              color: #374151;">` + fecha + `</span>` + "\r\n")
	inner.WriteString(`          </td>` + "\r\n")
	inner.WriteString(`        </tr>` + "\r\n")
	inner.WriteString(`      </table>` + "\r\n")
	inner.WriteString(`    </td>` + "\r\n")
	inner.WriteString(`  </tr>` + "\r\n")
	inner.WriteString(`</table>` + "\r\n")
	inner.WriteString(`<p style="margin: 24px 0 0 0; font-size: 14px;` + "\r\n")
	inner.WriteString(`  color: #6b7280; line-height: 1.6;">` + "\r\n")
	inner.WriteString(`  Ingrese al panel de administracion para gestionar` + "\r\n")
	inner.WriteString(`  este caso dentro del plazo establecido por ley.` + "\r\n")
	inner.WriteString(`</p>` + "\r\n")

	cuerpo := buildEmail(color, logoHTML, inner.String(), footerTexto)
	return s.enviarEmailBase(emailEmpresa, asunto, cuerpo, nil, "", b.logoData, b.logoMIME)
}

// EnviarResolucionCliente envía la respuesta final al cliente con PDF adjunto.
func (s *NotificacionService) EnviarResolucionCliente(
	ctx context.Context, paraEmail string, tenant *model.Tenant,
	codigoReclamo, nombreCliente, respuestaTexto string, pdfBytes []byte,
) error {
	if s.cfg.User == "" || s.cfg.Pass == "" {
		return nil
	}

	b := getBranding(tenant)
	color, logoHTML := b.color, b.logoHTML
	razon := "La Empresa"
	if tenant != nil {
		razon = tenant.RazonSocial
	}

	previewResp := respuestaTexto
	if len(previewResp) > 400 {
		previewResp = previewResp[:397] + "..."
	}

	vars := map[string]string{
		"nombre_cliente":    nombreCliente,
		"codigo_reclamo":    codigoReclamo,
		"respuesta_preview": previewResp,
		"razon_social":      razon,
	}

	asunto := "Resolucion de su caso - " + codigoReclamo
	saludoTexto := "Estimado(a) " + nombreCliente + ","
	cuerpoTexto := "Le informamos que su caso con codigo " + codigoReclamo + " ha sido atendido."
	footerTexto := "Resolucion emitida por <strong>" + razon + "</strong>\r\nconforme a la Ley N 29571."

	if p := s.obtenerPlantilla(ctx, tenant, model.EventoResolucion); p != nil {
		asunto = ReemplazarVariables(p.Asunto, vars)
		saludoTexto = ReemplazarVariables(p.Saludo, vars)
		cuerpoTexto = ReemplazarVariables(p.CuerpoPrincipal, vars)
		footerTexto = ReemplazarVariables(p.TextoPie, vars)
	}

	var inner strings.Builder
	inner.WriteString(`<h3 style="margin: 0 0 8px 0; font-size: 18px;` + "\r\n")
	inner.WriteString(`  color: #111827;">` + saludoTexto + `</h3>` + "\r\n")
	inner.WriteString(`<p style="margin: 0 0 24px 0; font-size: 15px;` + "\r\n")
	inner.WriteString(`  color: #4b5563; line-height: 1.6;">` + "\r\n")
	inner.WriteString(`  ` + cuerpoTexto + "\r\n")
	inner.WriteString(`</p>` + "\r\n")
	inner.WriteString(`<table role="presentation" width="100%"` + "\r\n")
	inner.WriteString(`  cellspacing="0" cellpadding="0" border="0"` + "\r\n")
	inner.WriteString(`  style="border-radius: 8px;` + "\r\n")
	inner.WriteString(`  border-left: 4px solid ` + color + `;` + "\r\n")
	inner.WriteString(`  background-color: #f8fafc;">` + "\r\n")
	inner.WriteString(`  <tr>` + "\r\n")
	inner.WriteString(`    <td style="padding: 20px 24px;">` + "\r\n")
	inner.WriteString(`      <p style="margin: 0; font-size: 14px;` + "\r\n")
	inner.WriteString(`        color: #374151; line-height: 1.7;` + "\r\n")
	inner.WriteString(`        font-style: italic;">` + "\r\n")

	writeWrapped(&inner, previewResp)

	inner.WriteString("\r\n")
	inner.WriteString(`      </p>` + "\r\n")
	inner.WriteString(`    </td>` + "\r\n")
	inner.WriteString(`  </tr>` + "\r\n")
	inner.WriteString(`</table>` + "\r\n")
	inner.WriteString(`<p style="margin: 24px 0 0 0; font-size: 14px;` + "\r\n")
	inner.WriteString(`  color: #4b5563; line-height: 1.6;">` + "\r\n")
	inner.WriteString(`  Adjunto encontrara el documento oficial en formato` + "\r\n")
	inner.WriteString(`  PDF con el detalle completo de la resolucion.` + "\r\n")
	inner.WriteString(`</p>` + "\r\n")
	inner.WriteString(buildBotonSeguimiento(s.app.URLPublica, b.slug, color, "Ver resolucion completa"))

	cuerpo := buildEmail(color, logoHTML, inner.String(), footerTexto)
	nombreArchivo := "Resolucion_" + codigoReclamo + ".pdf"
	return s.enviarEmailBase(paraEmail, asunto, cuerpo, pdfBytes, nombreArchivo, b.logoData, b.logoMIME)
}

// EnviarNotificacionCambioEstado notifica al cliente sobre un cambio de estado.
func (s *NotificacionService) EnviarNotificacionCambioEstado(
	ctx context.Context, emailDestino string, tenant *model.Tenant,
	codigo, nombreCliente, nuevoEstado string,
) error {
	if s.cfg.User == "" || s.cfg.Pass == "" {
		return nil
	}

	b := getBranding(tenant)
	color, logoHTML := b.color, b.logoHTML
	razon := "La Empresa"
	if tenant != nil {
		razon = tenant.RazonSocial
	}

	vars := map[string]string{
		"nombre_cliente": nombreCliente,
		"codigo_reclamo": codigo,
		"nuevo_estado":   nuevoEstado,
		"razon_social":   razon,
	}

	asunto := "Actualizacion de su caso - " + codigo
	saludoTexto := "Hola " + nombreCliente + ","
	cuerpoTexto := "El estado de su caso " + codigo + " ha sido actualizado:"
	footerTexto := "Notificacion enviada por <strong>" + razon + "</strong>."

	if p := s.obtenerPlantilla(ctx, tenant, model.EventoCambioEstado); p != nil {
		asunto = ReemplazarVariables(p.Asunto, vars)
		saludoTexto = ReemplazarVariables(p.Saludo, vars)
		cuerpoTexto = ReemplazarVariables(p.CuerpoPrincipal, vars)
		footerTexto = ReemplazarVariables(p.TextoPie, vars)
	}

	estadoColor := color
	estadoBg := "#f3f4f6"
	switch nuevoEstado {
	case "PENDIENTE":
		estadoColor = "#d97706"
		estadoBg = "#fef3c7"
	case "EN PROCESO":
		estadoColor = "#2563eb"
		estadoBg = "#dbeafe"
	case "RESUELTO":
		estadoColor = "#059669"
		estadoBg = "#d1fae5"
	case "CERRADO":
		estadoColor = "#6b7280"
		estadoBg = "#f3f4f6"
	case "RECHAZADO":
		estadoColor = "#dc2626"
		estadoBg = "#fee2e2"
	}

	var inner strings.Builder
	inner.WriteString(`<p style="margin: 0 0 8px 0; font-size: 16px;` + "\r\n")
	inner.WriteString(`  color: #374151;">` + saludoTexto + `</p>` + "\r\n")
	inner.WriteString(`<p style="margin: 0 0 28px 0; font-size: 15px;` + "\r\n")
	inner.WriteString(`  color: #4b5563; line-height: 1.6;">` + "\r\n")
	inner.WriteString(`  ` + cuerpoTexto + "\r\n")
	inner.WriteString(`</p>` + "\r\n")
	inner.WriteString(`<table role="presentation" width="100%"` + "\r\n")
	inner.WriteString(`  cellspacing="0" cellpadding="0" border="0">` + "\r\n")
	inner.WriteString(`  <tr>` + "\r\n")
	inner.WriteString(`    <td align="center"` + "\r\n")
	inner.WriteString(`      style="padding: 8px 0 32px 0;">` + "\r\n")
	inner.WriteString(`      <span style="display: inline-block;` + "\r\n")
	inner.WriteString(`        padding: 12px 32px; border-radius: 8px;` + "\r\n")
	inner.WriteString(`        font-size: 16px; font-weight: 700;` + "\r\n")
	inner.WriteString(`        color: ` + estadoColor + `;` + "\r\n")
	inner.WriteString(`        background-color: ` + estadoBg + `;` + "\r\n")
	inner.WriteString(`        text-transform: uppercase;` + "\r\n")
	inner.WriteString(`        letter-spacing: 1px;">` + "\r\n")
	inner.WriteString(`        ` + nuevoEstado + "\r\n")
	inner.WriteString(`      </span>` + "\r\n")
	inner.WriteString(`    </td>` + "\r\n")
	inner.WriteString(`  </tr>` + "\r\n")
	inner.WriteString(`</table>` + "\r\n")
	inner.WriteString(buildBotonSeguimiento(s.app.URLPublica, b.slug, color, "Consultar estado"))

	cuerpo := buildEmail(color, logoHTML, inner.String(), footerTexto)
	return s.enviarEmailBase(emailDestino, asunto, cuerpo, nil, "", b.logoData, b.logoMIME)
}

// EnviarNotificacionMensajeNuevo notifica al cliente de un nuevo mensaje de chat.
func (s *NotificacionService) EnviarNotificacionMensajeNuevo(
	ctx context.Context, emailDestino string, tenant *model.Tenant,
	codigo, nombreCliente, mensajePreview string,
) error {
	if s.cfg.User == "" || s.cfg.Pass == "" {
		return nil
	}

	b := getBranding(tenant)
	color, logoHTML, slug := b.color, b.logoHTML, b.slug
	razon := "La Empresa"
	if tenant != nil {
		razon = tenant.RazonSocial
	}

	preview := mensajePreview
	if len(preview) > 200 {
		preview = preview[:197] + "..."
	}

	vars := map[string]string{
		"nombre_cliente":  nombreCliente,
		"codigo_reclamo":  codigo,
		"mensaje_preview": preview,
		"razon_social":    razon,
		"slug_tenant":     slug,
	}

	asunto := "Nuevo mensaje sobre su caso " + codigo
	saludoTexto := "Hola " + nombreCliente + ","
	cuerpoTexto := "Ha recibido un nuevo mensaje respecto a su caso " + codigo + ":"
	footerTexto := "Mensaje enviado desde el portal de <strong>" + razon + "</strong>."
	botonTexto := "Responder Mensaje"

	if p := s.obtenerPlantilla(ctx, tenant, model.EventoNuevoMensaje); p != nil {
		asunto = ReemplazarVariables(p.Asunto, vars)
		saludoTexto = ReemplazarVariables(p.Saludo, vars)
		cuerpoTexto = ReemplazarVariables(p.CuerpoPrincipal, vars)
		footerTexto = ReemplazarVariables(p.TextoPie, vars)
		if p.TextoBoton != "" {
			botonTexto = ReemplazarVariables(p.TextoBoton, vars)
		}
	}

	var inner strings.Builder
	inner.WriteString(`<p style="margin: 0 0 8px 0; font-size: 16px;` + "\r\n")
	inner.WriteString(`  color: #374151;">` + saludoTexto + `</p>` + "\r\n")
	inner.WriteString(`<p style="margin: 0 0 24px 0; font-size: 15px;` + "\r\n")
	inner.WriteString(`  color: #4b5563; line-height: 1.6;">` + "\r\n")
	inner.WriteString(`  ` + cuerpoTexto + "\r\n")
	inner.WriteString(`</p>` + "\r\n")
	inner.WriteString(`<table role="presentation" width="100%"` + "\r\n")
	inner.WriteString(`  cellspacing="0" cellpadding="0" border="0"` + "\r\n")
	inner.WriteString(`  style="background-color: #f0fdf4;` + "\r\n")
	inner.WriteString(`  border-radius: 8px;` + "\r\n")
	inner.WriteString(`  border: 1px solid #bbf7d0;">` + "\r\n")
	inner.WriteString(`  <tr>` + "\r\n")
	inner.WriteString(`    <td style="padding: 18px 24px;">` + "\r\n")
	inner.WriteString(`      <p style="margin: 0; font-size: 14px;` + "\r\n")
	inner.WriteString(`        color: #166534; line-height: 1.7;` + "\r\n")
	inner.WriteString(`        font-style: italic;">` + "\r\n")
	writeWrapped(&inner, preview)
	inner.WriteString("\r\n")
	inner.WriteString(`      </p>` + "\r\n")
	inner.WriteString(`    </td>` + "\r\n")
	inner.WriteString(`  </tr>` + "\r\n")
	inner.WriteString(`</table>` + "\r\n")
	inner.WriteString(buildBotonSeguimiento(s.app.URLPublica, slug, color, botonTexto))

	cuerpo := buildEmail(color, logoHTML, inner.String(), footerTexto)
	return s.enviarEmailBase(emailDestino, asunto, cuerpo, nil, "", b.logoData, b.logoMIME)
}

// buildBotonSeguimiento genera el HTML de un botón CTA que lleva al portal de seguimiento.
func buildBotonSeguimiento(urlBase, slug, color, textoBoton string) string {
	// Sin dominio configurado no se puede construir un enlace valido: es
	// preferible omitir el boton que mandar un correo con un enlace roto.
	if urlBase == "" {
		return ""
	}
	url := urlBase + "/libro/" + slug + "/seguimiento"
	var sb strings.Builder
	sb.WriteString(`<table role="presentation" width="100%"` + "\r\n")
	sb.WriteString(`  cellspacing="0" cellpadding="0" border="0"` + "\r\n")
	sb.WriteString(`  style="margin-top: 28px;">` + "\r\n")
	sb.WriteString(`  <tr>` + "\r\n")
	sb.WriteString(`    <td align="center">` + "\r\n")
	sb.WriteString(`      <a href="` + url + `"` + "\r\n")
	sb.WriteString(`        style="display: inline-block;` + "\r\n")
	sb.WriteString(`        padding: 14px 32px;` + "\r\n")
	sb.WriteString(`        background-color: ` + color + `;` + "\r\n")
	sb.WriteString(`        color: #ffffff; text-decoration: none;` + "\r\n")
	sb.WriteString(`        border-radius: 8px; font-size: 14px;` + "\r\n")
	sb.WriteString(`        font-weight: 600;">` + "\r\n")
	sb.WriteString(`        ` + textoBoton + "\r\n")
	sb.WriteString(`      </a>` + "\r\n")
	sb.WriteString(`    </td>` + "\r\n")
	sb.WriteString(`  </tr>` + "\r\n")
	sb.WriteString(`</table>` + "\r\n")
	return sb.String()
}

// ─── SMTP BASE ──────────────────────────────────────────────────────────────

func (s *NotificacionService) enviarEmailBase(
	paraEmail, asunto, cuerpo string, adjunto []byte, nombreAdjunto string,
	logoData []byte, logoMIME string,
) error {
	addr := fmt.Sprintf("%s:%d", s.cfg.Host, s.cfg.Port)
	auth := smtp.PlainAuth("", s.cfg.User, s.cfg.Pass, s.cfg.Host)
	boundary := "----=_Part_LR_" + fmt.Sprintf("%d", time.Now().UnixNano())

	now := time.Now()
	// El Message-ID viaja en la cabecera de CADA correo, asi que su dominio
	// tiene que ser el del remitente y no uno fijo. Se toma de SMTP_FROM;
	// si no hay remitente configurado se usa "localhost", que es lo que
	// espera un servidor cuando el dominio es desconocido.
	dominio := "localhost"
	if i := strings.LastIndex(s.cfg.From, "@"); i >= 0 && i+1 < len(s.cfg.From) {
		dominio = s.cfg.From[i+1:]
	}
	msgID := fmt.Sprintf("<%d@%s>", now.UnixNano(), dominio)

	// Construir mensaje MIME con strings.Builder
	var msg strings.Builder

	// Headers
	msg.WriteString("From: \"Libro de Reclamaciones\" <" + s.cfg.From + ">\r\n")
	msg.WriteString("Reply-To: " + s.cfg.From + "\r\n")
	msg.WriteString("To: " + paraEmail + "\r\n")
	msg.WriteString("Subject: " + asunto + "\r\n")
	msg.WriteString("Date: " + now.Format(time.RFC1123Z) + "\r\n")
	msg.WriteString("Message-ID: " + msgID + "\r\n")
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString("Content-Type: multipart/mixed;\r\n")
	msg.WriteString("  boundary=\"" + boundary + "\"\r\n")
	msg.WriteString("\r\n")

	// Si hay logo inline, usar multipart/related para HTML + imagen
	if len(logoData) > 0 {
		relBoundary := "----=_Related_LR_" + fmt.Sprintf("%d", now.UnixNano()+1)
		msg.WriteString("--" + boundary + "\r\n")
		msg.WriteString("Content-Type: multipart/related;\r\n")
		msg.WriteString("  boundary=\"" + relBoundary + "\"\r\n")
		msg.WriteString("\r\n")

		// Parte 1a: HTML dentro de related
		msg.WriteString("--" + relBoundary + "\r\n")
		msg.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
		msg.WriteString("Content-Transfer-Encoding: base64\r\n")
		msg.WriteString("\r\n")
		encodedBody := base64.StdEncoding.EncodeToString([]byte(cuerpo))
		for i := 0; i < len(encodedBody); i += 76 {
			end := i + 76
			if end > len(encodedBody) {
				end = len(encodedBody)
			}
			msg.WriteString(encodedBody[i:end] + "\r\n")
		}
		msg.WriteString("\r\n")

		// Parte 1b: Logo inline con Content-ID
		msg.WriteString("--" + relBoundary + "\r\n")
		msg.WriteString("Content-Type: " + logoMIME + "\r\n")
		msg.WriteString("Content-Transfer-Encoding: base64\r\n")
		msg.WriteString("Content-ID: <logo>\r\n")
		msg.WriteString("Content-Disposition: inline; filename=\"logo.jpg\"\r\n")
		msg.WriteString("\r\n")
		encodedLogo := base64.StdEncoding.EncodeToString(logoData)
		for i := 0; i < len(encodedLogo); i += 76 {
			end := i + 76
			if end > len(encodedLogo) {
				end = len(encodedLogo)
			}
			msg.WriteString(encodedLogo[i:end] + "\r\n")
		}
		msg.WriteString("\r\n")
		msg.WriteString("--" + relBoundary + "--\r\n")
		msg.WriteString("\r\n")
	} else {
		// Sin logo: HTML directo
		msg.WriteString("--" + boundary + "\r\n")
		msg.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
		msg.WriteString("Content-Transfer-Encoding: base64\r\n")
		msg.WriteString("\r\n")
		encodedBody := base64.StdEncoding.EncodeToString([]byte(cuerpo))
		for i := 0; i < len(encodedBody); i += 76 {
			end := i + 76
			if end > len(encodedBody) {
				end = len(encodedBody)
			}
			msg.WriteString(encodedBody[i:end] + "\r\n")
		}
		msg.WriteString("\r\n")
	}

	// Parte 2: Adjunto PDF (si existe)
	if len(adjunto) > 0 {
		encoded := base64.StdEncoding.EncodeToString(adjunto)

		msg.WriteString("--" + boundary + "\r\n")
		msg.WriteString("Content-Type: application/pdf;\r\n")
		msg.WriteString("  name=\"" + nombreAdjunto + "\"\r\n")
		msg.WriteString("Content-Transfer-Encoding: base64\r\n")
		msg.WriteString("Content-Disposition: attachment;\r\n")
		msg.WriteString("  filename=\"" + nombreAdjunto + "\"\r\n")
		msg.WriteString("\r\n")

		for i := 0; i < len(encoded); i += 76 {
			end := i + 76
			if end > len(encoded) {
				end = len(encoded)
			}
			msg.WriteString(encoded[i:end])
			msg.WriteString("\r\n")
		}
	}

	// Cierre MIME
	msg.WriteString("--" + boundary + "--\r\n")

	// Conexión TLS directa (Puerto 465)
	tlsconfig := &tls.Config{
		InsecureSkipVerify: false,
		ServerName:         s.cfg.Host,
	}

	conn, err := tls.Dial("tcp", addr, tlsconfig)
	if err != nil {
		return fmt.Errorf("error al conectar via TLS: %w", err)
	}
	defer conn.Close()

	c, err := smtp.NewClient(conn, s.cfg.Host)
	if err != nil {
		return fmt.Errorf("error al crear cliente SMTP: %w", err)
	}
	defer c.Quit()

	if err = c.Auth(auth); err != nil {
		return fmt.Errorf("error en autenticacion SMTP: %w", err)
	}
	if err = c.Mail(s.cfg.From); err != nil {
		return err
	}
	if err = c.Rcpt(paraEmail); err != nil {
		return err
	}

	w, err := c.Data()
	if err != nil {
		return err
	}

	_, err = w.Write([]byte(msg.String()))
	if err != nil {
		return err
	}

	return w.Close()
}